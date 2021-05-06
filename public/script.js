$("#reset_password_popup").hide();
// var text = '[{allStati}]'
// var obj = JSON.parse(text);

// $(document).ready(function() {
//         var template = $('#user-template').html();
//         for(var i in obj)
//         {
//         var info = Mustache.render(template, obj[i]);
//         $('#ModuleUserTable').html(info);
//         }
// }); 

//NOTES ABOUT THIS:
/*  you must use function (event), no fat arrows
	this.id should work fine, if not - $(this).attr("id") OR $(this).prop("id")
*/
$(".ignore_file").click(function(event) {
	event.preventDefault();
	let curr_id = this.id;
	username = this.id.split("/")[0];
	$.ajax({
		url: "/farm/check-off/" + curr_id,
		dataType: 'html',
		success: function(result) {
			window.location.reload()
		}
	});
});

$("#reset_password").click(() => {
	$("#reset_password_popup").toggle();
});

$("#close_popup").click(() => {
	$("#reset_password_popup").toggle();
});