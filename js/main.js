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
	throw new Error('Lichess Enhancements: main.js aborted (_ld_ is undefined).');
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

var chess = new Chess();

// Stores a FEN history of the board, with a FEN for each particular position,
// as well as the move made to achieve that FEN.
var FENs = [];

var apiURL = 'http://' + location.host + '/api/game/' + _ld_.game.id;
var apiURLParams = '?with_moves=1&with_fens=1';

var loadMoves = function() {
	$.get(apiURL + apiURLParams, function(data) {
		var moves = data.moves.split(' ');

		// Push initial FEN.
		FENs.push('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

		if (typeof data.fens !== 'undefined') {
			for (var i = 0, l = moves.length; i < l;  i++) {
				chess.move(moves[i]);
			
				// Must add - - 0 1 or chess.js doesn't recognise it as a valid
				// FEN.
				FENs.push(data.fens[i] + ' ' + chess.turn() + ' - - 0 1');
			}
		}
		
		loadInterface();
	});
};

// chess.js doesn't support chess960, so we have to disable it for now.
if (_ld_.game.variant !== 'chess960') {
	loadMoves();
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

// Used for the chess.js promotion parameter.
var pieceLetters = {
	queen: 'q', bishop: 'b', knight: 'n', rook: 'r'
};

// Observe the board for moves being made and perform the same moves on the
// chess.js board.
var from = null;
var lastMove;

var boardObserver = new MutationObserver(function(mutations) {
	mutations.forEach(function(mutation) {
		var mutationTarget = $(mutation.target);

		// Only observe mutations from moves.
		if (!mutationTarget.hasClass('moved')) {
			return;
		}

		if (_ld_.game.variant === 'chess960') {
			updateScore();
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

		// If from or to are null, return. Also, we sometimes receive duplicate
		// mutations, so ignore them.
		if (typeof lastMove !== 'undefined') {
			if ((from === null || to === null) ||
			(lastMove.from === from && lastMove.to === to)) {
				return;
			}
		}

		var move = chess.move({
			from: from,
			to: to,

			// When promoting, the piece name is at the end of the class.
			promotion: pieceLetters[piece.attr('class').split(' ')[2]] || 'q'
		});

		if (move === null) return;

		FENs.push(chess.fen());

		lastMove = {from: from, to: to};

		// If piece was taken, update score.
		updateScore();

		// Append new moves to the PGN.

		var cloneExists = $('.le-clone').length;

		if (!cloneExists) {
			$('#le-GameText .moveOn').removeClass('moveOn');
		}

		var moveMarkup = '';
		var moveNum = chess.history().length / 2;
		var moveStyle = cloneExists ? 'moveNew' : 'moveOn';

		var $gameText = $('#le-GameText');

		// We might have hidden the PGN box earlier if we didn't have any moves.
		// So now we show it again. Do same for playback buttons.
		$gameText.show();
		$('.le-game_control').show();

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

// Add correct promotion to PGN.
$(document).on('click', '#promotion_choice div', function() {
	var pieceLetter = pieceLetters[$(this).attr('data-piece')];

	FENs.pop();

	var lastMove = chess.undo();
	var move = chess.move({
		from: lastMove.from,
		to: lastMove.to,
		promotion: pieceLetter
	});

	FENs.push(chess.fen());

	$('a.le-move:last-child').text(move.san);
});