var newList = [];
var audioPlayer = new Audio();
var selectedCountryId = 0;

// --- localStorage persistence ---

function savePlaylist() {
    localStorage.setItem('yoradio_playlist', JSON.stringify(newList));
}

function loadPlaylist() {
    try {
        return JSON.parse(localStorage.getItem('yoradio_playlist')) || [];
    } catch (e) {
        return [];
    }
}

// --- DataTable setup ---

$(document).ready(function () {
    get_countries_count();
    get_stations_count();
    get_countries();

    // Restore playlist from localStorage
    newList = loadPlaylist();
    updateNewListTable();

    // File import
    $('#import-list').click(function () {
        $('#import-file').click();
    });
    $('#import-file').change(function () {
        var file = $(this)[0].files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
            parseCSV(e.target.result);
        };
        reader.readAsText(file);
    });

    // Server-side DataTable for station browsing
    var stationsTable = $('#stations-by-countries').DataTable({
        serverSide: true,
        processing: true,
        searching: true,
        bLengthChange: false,
        ajax: {
            url: '/api/stations/datatable',
            type: 'GET',
            data: function (d) {
                return {
                    draw: d.draw,
                    start: d.start,
                    length: d.length,
                    search: d.search.value,
                    country_id: selectedCountryId
                };
            }
        },
        columns: [
            { data: 'country' },
            { data: 'title' },
            { data: 'final_url' },
            { data: null }
        ],
        columnDefs: [
            {
                targets: 2,
                render: function (data) {
                    var truncated = data.length > 20 ? data.substring(0, 20) + '...' : data;
                    return '<a href="' + data + '">' + truncated + '</a>';
                }
            },
            {
                targets: 3,
                orderable: false,
                render: function (data, type, row) {
                    var safeUrl = escapeHtml(row.final_url);
                    return '<div class="action-buttons">'
                        + '<button class="btn btn-success btn-icon play-btn" data-url="' + safeUrl + '" title="Play"><i class="fas fa-play"></i></button>'
                        + '<button class="btn btn-danger btn-icon stop-btn" title="Stop"><i class="fas fa-stop"></i></button>'
                        + '<button class="btn btn-primary btn-icon add-btn" data-title="' + escapeHtml(row.title) + '" data-url="' + safeUrl + '" title="Add to playlist"><i class="fas fa-plus"></i></button>'
                        + '<button class="btn btn-warning btn-icon remove-btn" data-title="' + escapeHtml(row.title) + '" data-url="' + safeUrl + '" title="Remove from playlist"><i class="fas fa-times"></i></button>'
                        + '</div>';
                }
            }
        ]
    });

    // Delegated event handlers for dynamically rendered rows
    $('#stations-by-countries tbody').on('click', '.play-btn', function () {
        playURL($(this).data('url'));
    });
    $('#stations-by-countries tbody').on('click', '.stop-btn', function () {
        stopPlayback();
    });
    $('#stations-by-countries tbody').on('click', '.add-btn', function () {
        addToNewList($(this).data('title'), $(this).data('url'));
    });
    $('#stations-by-countries tbody').on('click', '.remove-btn', function () {
        removeFromNewList($(this).data('title'), $(this).data('url'));
    });

    // Country filter — reload DataTable with new country_id
    $('#countries').change(function () {
        selectedCountryId = $(this).val();
        stationsTable.ajax.reload();
    });

    // Clear list
    $('#clear-list').click(function () {
        Swal.fire({
            title: 'Are you sure?',
            text: "Do you really want to clear the list?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, clear it!',
            cancelButtonText: 'No, keep it'
        }).then(function (result) {
            if (result.isConfirmed) {
                clearNewList();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Your list has been cleared.', showConfirmButton: false, timer: 1500 });
            }
        });
    });

    // Export list
    $('#export-list').click(function () {
        try {
            exportNewListToCSV();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Your list has been exported to a csv file.', showConfirmButton: false, timer: 1500 });
        } catch (error) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'There was a problem exporting the list.', showConfirmButton: false, timer: 1500 });
        }
    });
});

// --- Utility ---

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- Audio ---

function playURL(url) {
    audioPlayer.src = url;
    audioPlayer.play();
}

function stopPlayback() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
}

// --- Playlist management ---

function addToNewList(title, url) {
    var exists = newList.some(function (item) {
        return item.title === title && item.url === url;
    });
    if (exists) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Station already exists in the list!', showConfirmButton: false, timer: 1500 });
        return;
    }
    newList.push({ title: title, url: url, Ovol: 0 });
    savePlaylist();
    updateNewListTable();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Station added to the list!', showConfirmButton: false, timer: 1500 });
}

function removeFromNewList(title, url) {
    newList = newList.filter(function (item) {
        return !(item.title === title && item.url === url);
    });
    savePlaylist();
    updateNewListTable();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Station removed from the list!', showConfirmButton: false, timer: 1500 });
}

function clearNewList() {
    newList = [];
    savePlaylist();
    updateNewListTable();
}

function updateNewListTable() {
    var table = $('#new-list').DataTable();
    table.clear();
    newList.forEach(function (item) {
        var $remove = $('<button>').addClass('btn btn-danger btn-icon').html('<i class="fas fa-times"></i>').attr('title', 'Remove').click(function () {
            removeFromNewList(item.title, item.url);
        });
        table.row.add($('<tr>').append(
            $('<td>').text(item.title),
            $('<td>').text(item.url),
            $('<td>').text(item.Ovol),
            $('<td>').append($('<div class="action-buttons">').append($remove))
        ));
    });
    table.draw();
}

// --- Import/Export ---

function parseCSV(csvData) {
    var imported = csvData.trim().split('\n').map(function (row) {
        var cols = row.split('\t');
        return { title: cols[0].replace(/"/g, ''), url: cols[1], Ovol: cols[2] || 0 };
    });
    imported.forEach(function (item) {
        addToNewList(item.title, item.url);
    });
}

function exportNewListToCSV() {
    var content = newList.map(function (item) {
        return item.title + '\t' + item.url + '\t' + item.Ovol;
    }).join('\n');
    var link = document.createElement('a');
    link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURI(content));
    link.setAttribute('download', 'playlist.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Stats ---

function get_countries_count() {
    $.get('api/count/countries', function (data) {
        $('#countries-count').text(data.count);
    });
}

function get_stations_count() {
    $.get('api/count/stations', function (data) {
        $('#stations-count').text(data.count);
    });
}

function get_countries() {
    $.get('api/countries', function (data) {
        var select = $('#countries');
        $.each(data, function (i, v) {
            select.append($('<option>', { value: v.id, text: v.name }));
        });
    });
}
