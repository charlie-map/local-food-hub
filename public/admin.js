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
	$("#reset_password_popup").toggle();
});

$("#close_popup").click(() => {
	$("#reset_password_popup").toggle();
});

$("#slider").click(() => {
	let checked = !$('#check_value').is(':checked') ? 1 : 0;
	$.ajax({
		type: "GET",
		url: "/toggle-create-admin/" + checked,
		success: function(result) {
			location.reload();
		}
	});
});

$("#build-edit-response").hide();

// view farms page
$(".delete-button").click(function(event) {
	event.preventDefault();
	let username = this.id;
	$.ajax({
		url: "/delete-farm/" + username,
		dataType: 'html',
		success: function(result) {
			window.location.reload()
		}
	});
});

$(".re-fill-farm-name").click(function() {
	if ($("#build-edit-response").is(":visible")) {
		if ($("#title").text() == "Edit farm - farm name") {
			$("#build-edit-response").hide();
		} else {
			$("#title").text("Edit farm - farm name");
			$("#input-changer").attr("placeholder", "Change farm name");
			$("#type-qualify").attr("value", "farm_name");
			$("#name-qualify").attr("value", this.id);
		}
	} else {
		$("#build-edit-response").toggle();
		$("#title").text("Edit farm - farm name");
		$("#input-changer").attr("placeholder", "Change farm name");
		$("#type-qualify").attr("value", "farm_name");
		$("#name-qualify").attr("value", this.id);

	}
});

$(".re-fill-email").click(function() {
	if ($("#build-edit-response").is(":visible")) {
		if ($("#title").text() == "Edit farm - email") {
			$("#build-edit-response").hide();
		} else {
			$("#title").text("Edit farm - email");
			$("#input-changer").attr("placeholder", "Change farm email");
			$("#type-qualify").attr("value", "email");
			$("#name-qualify").attr("value", this.id);
		}
	} else {
		$("#build-edit-response").toggle();
		$("#title").text("Edit farm - email");
		$("#input-changer").attr("placeholder", "Change farm email");
		$("#type-qualify").attr("value", "email");
		$("#name-qualify").attr("value", this.id);
	}
});

$(".re-fill-id").click(function() {
	if ($("#build-edit-response").is(":visible")) {
		if ($("#title").text() == "Edit farm - folder ID") {
			$("#build-edit-response").hide();
		} else {
			$("#title").text("Edit farm - folder ID");
			$("#input-changer").attr("placeholder", "Change farm ID");
			$("#type-qualify").attr("value", "root_folder");
			$("#name-qualify").attr("value", this.id);
		}
	} else {
		$("#build-edit-response").toggle();
		$("#title").text("Edit farm - folder ID");
		$("#input-changer").attr("placeholder", "Change farm ID");
		$("#type-qualify").attr("value", "root_folder");
		$("#name-qualify").attr("value", this.id);
	}
});