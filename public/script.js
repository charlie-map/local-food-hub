if (window.performance && window.performance.navigation.type === 2)
	window.location.reload();

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

// $(document).ready(function(){
// 	$("#Farms").on('click','.btnDelete',function(){
// 		$(this).closest('tr').remove();
// 	});
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

$(".fill_out").click(function() {
	let id = this.id.split("/");
	$.ajax({
		type: "POST",
		url: "/farm/fill-out",
		dataType: 'html',
		data: {
			username: id[0],
			type: id[1],
			file_id: id[2]
		},
		success: function(result) {
			window.location = result;
		}
	})
});

// FROM W3SCHOOLS FOR ACCORDION
var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    /* Toggle between adding and removing the "active" class,
    to highlight the button that controls the panel */
    this.classList.toggle("active");

    /* Toggle between hiding and showing the active panel */
    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  });
}