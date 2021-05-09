$("#reset_password_popup").hide();

$("#submit").click(function(event) {
	event.preventDefault();
	$.ajax({
		type: "POST",
		url: "/make-farm",
		dataType: 'html',
		data: {
			farmname: $("#farmname").val(),
			username: $("#username").val(),
			email: $("#email").val(),
			psw: $("#password").val(),
			root_folder: $("#root_folder").val()
		},
		success: function(result) {
			if (parseInt(result, 10) == 1062) {
				alert("This username is already used");
			} else {
				location.reload();
			}
		}
	});
});

$(".view_popup").click(() => {
	console.log("hgello");
	$("#reset_password_popup").toggle();
});

$("#close_popup").click(() => {
	$("#reset_password_popup").toggle();
});