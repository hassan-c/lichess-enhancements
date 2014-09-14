// We want to be able to access Lichess' variables--specifically _ld_--so we
// inject a <script> tag into the page with the following code inside, which
// then sets a data-* attribute to the <body> tag of the page so that other
// parts of the extension can access the info inside _ld_.
var get_ld_ = function() {
	if (typeof _ld_ === 'undefined') {
		return;
	}

	$('body').attr('data-_ld_', JSON.stringify(_ld_));
};

var script = document.createElement('script');
script.appendChild(document.createTextNode('('+ get_ld_ +')();'));
(document.body || document.head || document.documentElement).appendChild(script);

var data_ld_ = $('body').attr('data-_ld_');

if (typeof data_ld_ === 'undefined') {
	throw new Error('Lichess Enhancements stopped: _ld_ is undefined.');
}

var _ld_ = JSON.parse(data_ld_);

var loadInterface = function() {
	// Append the playback and move history buttons to the page.
	var $gameButtons = $('<div id="le-GameButtonsWrapper">');
	$gameButtons.load(chrome.extension.getURL('views/game-buttons.html'));
	$('.table_inner').before($gameButtons);

	var $pgn = $('<div id="le-pgn">');
	$pgn.load(chrome.extension.getURL('views/pgn.html'));
	$('.table_inner').before($pgn);
};

var pgnURL = 'http://' + location.host + '/' + _ld_.game.id + '/pgn';
var loadPGN = function() {
	$.get(pgnURL, function(data) {
		chess.load_pgn(data);
		loadInterface();
	}).fail(function() {
		console.error('LE.Error: Could not load PGN from ' + pgnURL);
	});
};

// Lichess allows us to access a list of all previous moves played in the game
// via _ld_.game.moves only if we are not spectating.
// We make an API call to access the PGN otherwise.
var chess = new Chess();

// chess.js doesn't support chess960, so we disallow it for now.
if (!_ld_.player.spectator && _ld_.game.variant !== 'chess960') {
	var moves = _ld_.game.moves.split(' ');
	for (var i = moves.length - 1; i >= 0; i--) {
		chess.move(moves[moves.length - i - 1]);
	}
	loadInterface();
} else {
	if (_ld_.game.variant !== 'chess960') {
		loadPGN();
	}
}

// This doesn't seem to work if we set it via CSS, so for now we set it here.
$('.moretime').css({'position':'absolute', 'right':'2px', 'top':'37px'});

if (_ld_.game.clock) {
	$('.clock_black').append(' <div id="le-black-score"></div>');
	$('.clock_white').append(' <div id="le-white-score"></div>');
} else {
	if (_ld_.player.color === 'white') {
		$('.lichess_table').after(' <div id="le-white-score"></div>');
		$('.lichess_table').before(' <div id="le-black-score"></div>');
	} else {
		$('.lichess_table').after(' <div id="le-black-score"></div>');
		$('.lichess_table').before(' <div id="le-white-score"></div>');
	}
}

// Calculates and updates the score.
var pieceValues = { pawn: 1, bishop: 3, knight: 3, rook: 5, queen: 9 };
var updateScore = function() {
	var scoreWhite = 0;
	var scoreBlack = 0;

	var $scoreWhite = $('#le-white-score');
	var $scoreBlack = $('#le-black-score');

	$('.lichess_cemetery.black .piece').each(function() {
		// Temporary fix for flickering problem.
		$(this).show();

		var pieceName = $(this).attr('class').split(' ')[1];

		// Sometimes score becomes NaN... hopefully this will fix
		if (pieceValues.hasOwnProperty(pieceName)) {
			scoreWhite += pieceValues[pieceName];
		}
	});

	$('.lichess_cemetery.white .piece').each(function() {
		// Temporary fix for flickering problem.
		$(this).show();

		var pieceName = $(this).attr('class').split(' ')[1];
		
		if (pieceValues.hasOwnProperty(pieceName)) {
			scoreBlack += pieceValues[pieceName];
		}
	});

	if (scoreWhite > scoreBlack) {
		$scoreWhite.css({'color' : '#759900'}); // green
		$scoreBlack.css({'color' : '#ac524f'}); // red
	} else if (scoreBlack > scoreWhite) {
		$scoreWhite.css({'color' : '#ac524f'});
		$scoreBlack.css({'color' : '#759900'});
	} else {
		$scoreWhite.css({'color' : 'inherit'});
		$scoreBlack.css({'color' : 'inherit'});
	}

	$scoreWhite.text(scoreWhite);
	$scoreBlack.text(scoreBlack);
};

updateScore();

// Observe the board for moves being made and perform the same moves on the
// chess.js board.
var from = null;
var promoteTo = 'q';

// Stores a FEN history of the board, with a FEN for each particular position,
// an array for the move made to achieve that position, as well as an indicator
// whether either side was in check.
var boardHistory = [];

var $gameText;

var boardObserver = new MutationObserver(function(mutations) {
	mutations.forEach(function(mutation) {
		
		if (_ld_.game.variant === 'chess960') {
			updateScore();
			return;
		}

		var mutationTarget = $(mutation.target);

		// Only observe mutations from moves.
		if (!mutationTarget.hasClass('moved')) {
			return;
		}

		var piece = mutationTarget.find('.piece');

		// If div.piece doesn't exist, then we know the mutation is due to the
		// cell from which the piece moved.
		if (!piece.length) {
			from = mutation.target.id;
			return;
		}

		var to = mutation.target.id;

		var move = chess.move({
			from: from,
			to: to,
			promotion: promoteTo
		});

		if (move === null) {

			// Sometimes we receive extraneous mutations due to capturing or
			// castling. In these cases, we simply return.
			//
			// There is a rarer case which tends to occur if the page happens to
			// load slowly. When this happens, we aren't able to keep up with
			// the mutations until the page fully loads and this results in LE
			// becoming out-of-sync with Lichess.
			//
			// We can know when this has happened by detecting if the last-last
			// move was null *and* the last move in the history did not involve
			// castling.
			// 
			// But at the moment, it doesn't seem to work. 

			// if (rawMoveHistory[rawMoveHistory.length - 2] === null
			// 	&& oldHistory[oldHistory.length - 1].indexOf('O') === -1) {

			// 	console.log('something gone wrong... reloading pgn');
			// }

			return;
		}

		boardHistory.push({
			fen: chess.fen(),
			inCheck: chess.in_check() ? chess.turn() : null,
			move: [from, to]
		});

		// If piece was taken, update score.
		// Temporarily commented out due to the bug mentioned just above.
		// if (move.san.indexOf('x') > -1) {
			updateScore();
			// @todo Instead of re-calling this each mutation, just keep an in-
			// house list of captured pieces and update from there.
		// }

		// Append new moves to the PGN.

		var cloneExists = $('.le-clone').length;

		if (!cloneExists) {
			$('#le-GameText .moveOn').removeClass('moveOn');
		}

		var moveMarkup = '';
		var moveNum = chess.history().length / 2;
		var moveStyle = cloneExists ? 'moveNew' : 'moveOn';

		$gameText = $('#le-GameText');

		// We might have hidden the PGN box earlier if we didn't have any moves.
		// So now we show it again.
		$gameText.show();

		// @todo Clean this up.

		if (!Number.isInteger(moveNum)) {
			var realMoveNum = Math.ceil(moveNum);
			moveMarkup += ((realMoveNum === 1 ? '' : '<br />') + '<span class="le-move notranslate ' + (moveStyle === 'moveNew' ? 'moveNew' : '') + '">' +  realMoveNum + '.</span>');
		}

		
		moveMarkup += ('<a class="le-move notranslate ' + moveStyle + '" id="le-move-' + (moveNum * 2) + '">' + move.san + '</a>');

		$gameText.append(moveMarkup);

		// We don't want to scroll to the latest move if we're browsing earlier
		// ones. Also, we check if #le-GameText actually exists to avoid errors
		// like "cannot read property scrollHeight of undefined" which sometimes
		// happens if we try to perform scrollTop on #le-GameText if it hasn't
		// yet been loaded into the DOM.
		if (!cloneExists && $gameText.length) {
			// Scroll to bottom.
			$gameText.scrollTop($gameText[0].scrollHeight);
		}
	});
});

var liBoard = $('.lichess_board:not(.le-clone)')[0];
boardObserver.observe(liBoard, {
	childList: true,
	subtree: true
});