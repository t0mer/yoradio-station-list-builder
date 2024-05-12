
$(document).ready(function () {
    get_countries_count();
    get_stations_count();
});





function get_countries_count() {
    $.get("api/count/countries", function (data) {
        $('#countries-count').text(data.count);
    });
}

function get_stations_count() {
    $.get("api/count/stations", function (data) {
        $('#stations-count').text(data.count);
    });
}