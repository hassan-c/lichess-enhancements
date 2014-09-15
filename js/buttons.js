var _chess;

// Creates a clone of the Lichess board and adds it to the DOM.
// @todo? Don't add clone to DOM until we have finished calling updateBoard().
// Performing manipulations while our clone isn't yet in the DOM may be cheaper.
var createBoard = function() {
	// Don't create another clone if one already exists.
	if ($('.le-clone').length) {
		return;
	}

	var liBoardClone = $('.lichess_board').clone();
	liBoardClone.addClass('le-clone');

	// Hide the original board and add the clone where it was.
	$('.lichess_board:not(.le-clone)').hide();
	$('.lichess_board_wrap').prepend(liBoardClone);

	// Pieces sometimes flicker while you are viewing earlier moves and a new
	// move is made in the game. This is a temporary fix.
	$('.lichess_board:not(.le-clone) .piece').hide();

	// Prevent the user from dragging around pieces in the clone.
	$('.le-clone > div').removeClass('ui-draggable ui-droppable selected');
};

// Store piece and colour names in these objects so that we can convert them
// to their full names by passing the first letter as the key.

var piece = {
	p: 'pawn', b: 'bishop', n: 'knight', r: 'rook', q: 'queen', k: 'king'
};
var color = {w: 'white', b: 'black'};

var goToMove = function(move) {
	move = parseInt(move);

	if (move === (FENs.length - 1)) {
		moveToEnd();
		return;
	}

	createBoard();

	_chess = new Chess(FENs[move]);

	// Update the clone's pieces to the new state.
	$('.le-clone > div').each(function() {
		$(this).find('.piece').remove();

		var id = _chess.get($(this).prop('id'));

		if (id === null) {
			// A piece doesn't exist in this square, so return non-false value
			// to skip next iteration.
			return true;
		}

		$(this).append($('<div>', {
			class: 'piece ' + piece[id.type] + ' ' + color[id.color]
		}));
	});

	// Update the green glowing indicators that show what the last move was.
	$('.le-clone .moved').removeClass('moved');

	// If the current clone-state has a check, remove the indicator.
	$('.le-clone .check').removeClass('check');

	// If in check, update the indicator.
	if (_chess.in_check()) {
		var col = chess.turn() === 'w' ? 'b' : 'w';
		$('.le-clone .piece.king.' + color[col]).parent().addClass('check');
	}

	$('.moveOn').removeClass('moveOn');
	$('#le-move-' + move).addClass('moveOn');

	var moveNew = $('#le-move-' + move + '.moveNew');
	moveNew.prevAll('span:first').removeClass('moveNew');
	moveNew.removeClass('moveNew');

	// Doesn't seem to work... so for now, we do it the dirty way.
	// $('#le-GameText').scrollTop($('#le-move-' + (_history.length + 1)).position().top);

	// 17 is the height of each row
	$('#le-GameText').scrollTop(Math.floor((getCurrentMoveNum() + 1) / 2) * 17);

	if (move < 1) {
		return;
	}

	var moved = chess.history({verbose: true})[move - 1];

	$('#' + moved.from).addClass('moved');
	$('#' + moved.to).addClass('moved');
};

var getCurrentMoveNum = function() {
	var currentMove = $('.moveOn').prop('id');

	if (!currentMove) {
		return 0;
	}

	return parseInt(currentMove.split('-')[2]);
};

// Moves the clone to the start of the game.
var moveToStart = function() {
	stopAutoplay();
	createBoard();

	goToMove(0);
};

// Moves the clone back one move.
var moveBackward = function() {
	stopAutoplay();
	createBoard();

	goToMove(getCurrentMoveNum() - 1);
};

// Move the clone forward one move.
// We separate this from moveForward() so we can call it from doAutoplay().
var doMoveForward = function() {
	goToMove(getCurrentMoveNum() + 1);
};

var moveForward = function() {
	if (!$('.le-clone').length) {
		return;
	}

	stopAutoplay();
	doMoveForward();
};

// Destroys the clone, returning to the latest move.
var moveToEnd = function() {
	if (!$('.le-clone').length) {
		return;
	}

	stopAutoplay();

	$('.le-clone').remove();

	// Temporary fix for piece-flicker problem--see createBoard() above.
	$('.lichess_board:not(.le-clone)').show();
	$('.lichess_board:not(.le-clone) .piece').show();

	$('.moveNew').removeClass('moveNew');
	$('.moveOn').removeClass('moveOn');

	$('#le-GameText #le-move-' + (FENs.length - 1)).addClass('moveOn');
	$('#le-GameText').scrollTop($('#le-GameText')[0].scrollHeight);
};

var autoplay;
var stopAutoplay = function() {
	clearInterval(autoplay);
	$('#autoplayButton').attr('data-hint', 'toggle autoplay (start)');
};

// Autoplays through the moves.
var doAutoplay = function() {
	if (!$('.le-clone').length) {
		return;
	}

	if ($(this).attr('data-hint') === 'toggle autoplay (start)') {
		$(this).attr('data-hint', 'toggle autoplay (stop)');
	} else {
		stopAutoplay();
		return;
	}

	// Eliminates the initial delay.
	doMoveForward();

	// @todo Make delay configurable through an options page.
	var delay = 1000;
	autoplay = setInterval(function() {
		doMoveForward();
	}, delay);
};

$(document).on('click', '#startButton', moveToStart);
$(document).on('click', '#backButton', moveBackward);
$(document).on('click', '#autoplayButton', doAutoplay);
$(document).on('click', '#forwardButton', moveForward);
$(document).on('click', '#endButton', moveToEnd);

// Add keyboard support.
$(document).keydown(function(event) {
	// If user is typing something, return.
	if ($('.lichess_say').is(':focus')) {
		return;
	}

	switch (event.keyCode) {
		// h or up-arrow
		case 72:
		case 38:
			event.preventDefault();
			moveToStart();
			break;
		// j or left-arrow
		case 74:
		case 37:
			event.preventDefault();
			moveBackward();
			break;
		// k or right-arrow
		case 75:
		case 39:
			event.preventDefault();
			moveForward();
			break;
		// l or down-arrow
		case 76:
		case 40:
			event.preventDefault();
			moveToEnd();
			break;
	}
});