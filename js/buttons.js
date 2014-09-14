var _chess;

// Creates a clone of our original chess object.
var updateChess = function() {
	_chess = new Chess();
	_chess.load_pgn(chess.pgn());
};

// Creates a clone of the Lichess board and adds it to the DOM.
// @todo? Don't add clone to DOM until we have finished calling updateBoard().
// Performing manipulations while our clone isn't yet in the DOM may be cheaper.
var createBoard = function() {

	// Don't create another clone if one already exists.
	// There's also no need to create a clone if no moves have been made.
	if ($('.le-clone').length || _chess.history().length === 0) {
		return;
	}

	var liBoardClone = $('.lichess_board').clone();
	liBoardClone.addClass('le-clone');

	// Hide the original board and add the clone where it was.
	$('.lichess_board:not(.le-clone)').hide();
	$('.lichess_board_wrap').prepend(liBoardClone);

	// Pieces sometimes flicker while you are viewing earlier moves and a new
	// move is made in the game. This is a temporary fix.
	$('.lichess_board:not(.le-clone) .piece').each(function() {
		$(this).hide();
	});

	// If we're spectating, we don't need to do the last step, so return.
	if (_ld_.player.spectator) {
		return;
	}

	// Prevent the user from dragging around pieces in the clone.
	$('.le-clone > div').each(function() {
		$(this).removeClass('ui-draggable ui-droppable selected');
	});
};

// Store piece and colour names in these objects so that we can convert them
// to their full names by passing the first letter as the key.

var piece = {
	p: 'pawn', b: 'bishop', n: 'knight',
	r: 'rook', q: 'queen', k: 'king'
};

var color = { w: 'white', b: 'black' };

// Updates the cloned board.
var updateBoard = function() {

	// Update the clone's pieces to the new state.
	// @todo Optimise.
	$('.le-clone > div').each(function() {
		$(this).find('.piece').remove();

		var id = _chess.get($(this).attr('id'));

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
	$('.le-clone .moved').each(function() {
		$(this).removeClass('moved');
	});

	// If the current clone-state has a check, remove the indicator.
	$('.le-clone .check').removeClass('check');
	
	var _history = _chess.history({ verbose: true });
	var _lastMove = _history[_history.length - 1];

	// Only add new green glowing indicators if at least one move has been made.
	if (_history.length > 0) {			
		$('.le-clone #' + _lastMove.from).addClass('moved');
		$('.le-clone #' + _lastMove.to).addClass('moved');

		// If there was a check made in the last move, update the indicator.
		if (_lastMove.san.indexOf('+') > -1) {
			var _lastMoveColor = color[_lastMove.color === 'w' ? 'b' : 'w'];
			$('.le-clone .piece.king.' + _lastMoveColor).parent().addClass('check');
		}
	}

	$('.moveOn').removeClass('moveOn');

	$('#le-move-' + _history.length).addClass('moveOn');

	// Doesn't seem to work... so for now, we do it the dirty way.
	// $('#le-GameText').scrollTop($('#le-move-' + (_history.length + 1)).position().top);

	// 17 is the height of each row
	$('#le-GameText').scrollTop(Math.floor((_history.length - 1) / 2) * 17);
};

// Moves the clone to the start of the game.
var moveToStart = function() {
	if (!$('.le-clone').length) {
		updateChess();
	}

	stopAutoplay();
	createBoard();

	_chess.reset();

	updateBoard();
};

// Moves the clone back one move.
var moveBackward = function() {
	if (!$('.le-clone').length) {
		updateChess();
	}

	stopAutoplay();
	createBoard();

	_chess.undo();

	updateBoard();
};

// Move the clone forward one move.
// We separate this from moveForward() so we can call it from doAutoplay().
var doMoveForward = function() {
	_chess.move(chess.history()[_chess.history().length]);

	// We're already on the last move.
	if (_chess.history().length === chess.history().length) {
		moveToEnd();
		return;
	}

	updateBoard();

	var moveNew = $('#le-move-' + _chess.history().length + '.moveNew');
	moveNew.prevAll('span:first').removeClass('moveNew');
	moveNew.removeClass('moveNew');
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

	$('.le-clone').html(null);
	$('.le-clone').remove();

	// Temporary fix for piece-flicker problem--see createBoard() above.
	$('.lichess_board:not(.le-clone)').show();
	$('.lichess_board:not(.le-clone) .piece').each(function() {
		$(this).show();
	});

	$('.moveNew').removeClass('moveNew');
	$('.moveOn').removeClass('moveOn');

	$('#le-GameText #le-move-' + chess.history().length).addClass('moveOn');
	$('#le-GameText').scrollTop($('#le-GameText')[0].scrollHeight);
};

var autoplay = null;
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
		clearInterval(autoplay);
		$(this).attr('data-hint', 'toggle autoplay (start)');
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

// Replacement for the onfocus="this.blur();" that was present previously.
$('.le-game_control').focus(function() {
	$(this).blur();
});