$(document).ready(function () {
    get_countries_count();
    get_stations_count();
    get_countries();

    // Initialize DataTable
    var stationsTable = $('#stations-by-countries').DataTable({
        "searching": true,
        "showing": false,
        "bLengthChange": false,
        "paging": true
    });

    $('#countries').change(function () {
        var country_id = $(this).val();
        console.log(country_id);
        get_stations_by_country(country_id, stationsTable);
    });
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

function get_countries() {
    $.ajax({
        url: 'api/countries',
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            var selectBox = $('#countries');

            // Loop through the JSON data and append options to the select box
            $.each(data, function (index, value) {
                console.log(value.name + " : " + value.id);
                selectBox.append($('<option>', {
                    value: value.id,
                    text: value.name
                }));
            });
            //   selectBox.find('option:first').prop('selected', true);
        },
        error: function (xhr, status, error) {
            console.error(status + ': ' + error);
        }
    });
}




var audioPlayer = new Audio();

function createPlayHandler(url) {
    return function() {
        playURL(url);
    };
}


function playURL(url) {
    audioPlayer.src = url;
    audioPlayer.play();
}

function stopPlayback() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
}



function createAddHandler(title, url) {
    return function() {
        addToNewList(title, url);
    };
}

function createRemoveHandler(title, url) {
    return function() {
        removeFromNewList(title, url);
    };
}


var newList = [];

function addToNewList(title, url) {
    newList.push({title: title, url: url, Ovol: 0});
    console.log("Added to new list:", title, url);
    console.log("Updated newList:", newList);

}

function removeFromNewList(title, url) {
    newList = newList.filter(item => item.title !== title || item.url !== url);
    console.log("Removed from new list:", title, url);
    console.log("Updated newList:", newList);
}

function get_stations_by_country(country_id, dataTable) {
    dataTable.clear().draw(); // Clear existing DataTable

    $.get("/api/stations/" + country_id, function (data) {
        var batchSize = 100; // Adjust the batch size as needed
        var index = 0;

        function processBatch() {
            for (var i = 0; i < batchSize && index < data.length; i++) {
                var item = data[index];
                var maxLength = 20;
                var truncatedUrl = item["final_url"].length > maxLength ? item["final_url"].substring(0, maxLength) + '...' : item["final_url"];

                var $urlLink = $('<a>').attr('href', item["final_url"]).text(truncatedUrl);
                var $playButton = $('<button>').addClass('btn btn-play').html('<i class="fas fa-play" title="Play"></i>').click(createPlayHandler(item["final_url"]));
                var $stopButton = $('<button>').addClass('btn btn-stop').html('<i class="fas fa-stop" title="Stop"></i>').click(stopPlayback);
                var $addButton = $('<button>').addClass('btn btn-add').html('<i class="fas fa-plus" title="Add"></i>').click(createAddHandler(item["title"], item["final_url"]));
                var $removeButton = $('<button>').addClass('btn btn-remove').html('<i class="fas fa-minus" title="Remove"></i>').click(createRemoveHandler(item["title"], item["final_url"]));

                var $tr = $('<tr>').append(
                    $('<td class="vmiddle">').text(item["country"]),
                    $('<td class="vmiddle">').text(item["title"]),
                    $('<td class="vmiddle">').append($urlLink),
                    $('<td class="srv vmiddle" id="' + item["id"] + '" >').append($playButton, ' ', $stopButton, ' ', $addButton, ' ', $removeButton)
                );

                dataTable.row.add($tr); // Add the row to DataTable
                index++;
            }

            dataTable.draw(); // Draw the DataTable after processing the batch

            if (index < data.length) {
                // Process next batch after a short delay to prevent blocking the main thread
                setTimeout(processBatch, 0);
            }
        }

        processBatch(); // Start processing the first batch
    });
}