var text = '[{"File Name":"John", "File ID":"john@gmail.com"},{"File Name":"Mary", "File ID":"mary@gmail.com"}]'
var obj = {people: JSON.parse(text)};

$(document).ready(function() {
    var template = $('#user-template').html();
    var info = Mustache.render(template, obj);
    $('#ModuleUserTable').append(info);
});