// Fix positioning of PGN box if no time controls.
// @todo Do this a better way.
if (!_ld_.game.clock) {
	// -32px

	$('.le-game_control').css({'top':'-23px'});
	$('#le-GameText').css({'top':'0px'});
}

var le_history = chess.history();

// Build up a string of what we need to set #le-GameText to and then set it.
// This seems to be faster than .append()ing after each move we find.
var pgn = '';
for (var i = 0, l = le_history.length; i < l; ++i) {
	if (i % 2 === 0) {
		var moveNum = Math.ceil((i + 1) / 2);
		pgn += ((moveNum === 1 ? '' : '<br />') + '<span class="le-move notranslate">' + moveNum + '.</span>');
	}

	pgn += ('<a class="le-move notranslate" id="le-move-' + (i + 1) + '">' + le_history[i] + '</a>');
}

$('#le-GameText').html(pgn);

// Hide the PGN box if we don't have any moves yet.
if (le_history.length === 0) {
	$('#le-GameText').hide();
}

// Add moveOn class to last move.
$('#le-GameText a.le-move:last-child').addClass('moveOn');

var goToMove = function(move) {

};

$('#le-GameText').on('click', 'a.le-move', function() {
	$('#le-GameText .moveOn').removeClass('moveOn');
	$(this).addClass('moveOn');
	// goToMove(3);
});

// Replacement for having onclick="this.blur();" on the elements.
$('#le-GameText').on('focus', 'a.le-move', function() {
	$(this).blur();
});

$('#le-GameText').scrollTop($('#le-GameText')[0].scrollHeight);