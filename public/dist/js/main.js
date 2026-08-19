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

    // Initialise the playlist table explicitly. Declaring the widths up front
    // (with autoWidth off) is what stops a long stream URL from collapsing the
    // station name column.
    // The playlist is an ordered list, not a data grid: its row order is the
    // station order on the device, so sorting, paging and a second search box
    // would all misrepresent what the user is building.
    $('#new-list').DataTable({
        autoWidth: false,
        responsive: true,
        ordering: false,
        paging: false,
        searching: false,
        info: false,
        language: {
            emptyTable: 'No stations yet — add some from the list above.'
        },
        columns: [
            { width: '42%', responsivePriority: 1 },
            { width: '34%', responsivePriority: 4 },
            { width: '10%', responsivePriority: 3 },
            { width: '14%', responsivePriority: 2, orderable: false }
        ]
    });

    // Restore playlist from localStorage
    newList = loadPlaylist();
    updateNewListTable();

    // File import
    $('#import-list').click(function () {
        $('#import-file').click();
    });
    $('#import-file').change(function () {
        var input = this;
        var file = input.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
            parseCSV(e.target.result);
            // Clear the input so re-importing the same file fires change again.
            input.value = '';
        };
        reader.readAsText(file);
    });

    // Server-side DataTable for station browsing
    var stationsTable = $('#stations-by-countries').DataTable({
        serverSide: true,
        processing: true,
        searching: true,
        responsive: true,
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
        // Priorities decide what survives on a narrow screen: the station name
        // and the action buttons stay, the URL collapses into the child row
        // first, then the country.
        columns: [
            { data: 'country', responsivePriority: 3 },
            { data: 'title', responsivePriority: 1 },
            { data: 'final_url', responsivePriority: 4 },
            { data: null, responsivePriority: 2 }
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

// Playlist order is the station order on the YoRadio device, so moving an entry
// is a first-class action rather than a table sort.
function moveInNewList(index, delta) {
    var target = index + delta;
    if (index < 0 || index >= newList.length || target < 0 || target >= newList.length) {
        return;
    }
    var moved = newList.splice(index, 1)[0];
    newList.splice(target, 0, moved);
    savePlaylist();
    updateNewListTable();
}

function clearNewList() {
    newList = [];
    savePlaylist();
    updateNewListTable();
}

function updateNewListTable() {
    var table = $('#new-list').DataTable();
    table.clear();
    newList.forEach(function (item, index) {
        var $up = $('<button>')
            .addClass('btn btn-muted btn-icon')
            .html('<i class="fas fa-arrow-up"></i>')
            .attr({ title: 'Move up', 'aria-label': 'Move ' + item.title + ' up' })
            .prop('disabled', index === 0)
            .click(function () {
                moveInNewList(index, -1);
            });

        var $down = $('<button>')
            .addClass('btn btn-muted btn-icon')
            .html('<i class="fas fa-arrow-down"></i>')
            .attr({ title: 'Move down', 'aria-label': 'Move ' + item.title + ' down' })
            .prop('disabled', index === newList.length - 1)
            .click(function () {
                moveInNewList(index, 1);
            });

        var $remove = $('<button>')
            .addClass('btn btn-danger btn-icon')
            .html('<i class="fas fa-times"></i>')
            .attr({ title: 'Remove', 'aria-label': 'Remove ' + item.title })
            .click(function () {
                removeFromNewList(item.title, item.url);
            });

        table.row.add($('<tr>').append(
            $('<td>').text(item.title),
            $('<td>').addClass('url-cell').attr('title', item.url).text(item.url),
            $('<td>').text(item.Ovol),
            $('<td>').append($('<div class="action-buttons">').append($up, $down, $remove))
        ));
    });
    table.draw();
}

// --- Import/Export ---

function normaliseOvol(value) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function parseCSV(csvData) {
    var added = 0;
    var duplicates = 0;
    var skipped = 0;

    csvData.split(/\r?\n/).forEach(function (line) {
        if (!line.trim()) {
            return;
        }

        var cols = line.split('\t');
        var title = (cols[0] || '').replace(/"/g, '').trim();
        var url = (cols[1] || '').trim();

        // A usable record needs a name and an http(s) stream URL. Without this
        // check a line with no tab was imported as an entry whose url was
        // undefined, which then exported back out as the string "undefined".
        if (!title || !/^https?:\/\//i.test(url)) {
            skipped++;
            return;
        }

        var exists = newList.some(function (item) {
            return item.title === title && item.url === url;
        });
        if (exists) {
            duplicates++;
            return;
        }

        newList.push({ title: title, url: url, Ovol: normaliseOvol(cols[2]) });
        added++;
    });

    savePlaylist();
    updateNewListTable();

    // One summary toast for the whole file rather than one per row.
    var summary = added + ' station' + (added === 1 ? '' : 's') + ' imported';
    if (duplicates) {
        summary += ', ' + duplicates + ' already in the list';
    }
    if (skipped) {
        summary += ', ' + skipped + ' skipped';
    }
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: added ? 'success' : 'error',
        title: summary,
        showConfirmButton: false,
        timer: 2500
    });
}

function exportNewListToCSV() {
    // One newline-terminated "title\turl\tOvol" record per station, as YoRadio
    // expects. Built as a Blob rather than a data: URL — encodeURI leaves '#'
    // untouched, so a station like "Rock #1" silently truncated the download at
    // the fragment marker.
    var content = newList.map(function (item) {
        return item.title + '\t' + item.url + '\t' + item.Ovol + '\n';
    }).join('');
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'playlist.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
