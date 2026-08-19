var newList = [];
var audioPlayer = new Audio();
var selectedCountryId = 0;
var currentStation = null;
var playerState = 'stopped';

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
            { responsivePriority: 1 },
            { responsivePriority: 4 },
            { responsivePriority: 3 },
            { responsivePriority: 2, orderable: false }
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
                targets: 0,
                render: function (data) {
                    return flagImage(data) + escapeHtml(data);
                }
            },
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
                    var safeTitle = escapeHtml(row.title);
                    return '<div class="action-buttons">'
                        + '<button class="btn btn-success btn-icon play-btn" data-title="' + safeTitle + '" data-url="' + safeUrl + '" title="Play" aria-label="Play"><i class="fas fa-play"></i></button>'
                        + '<button class="btn btn-primary btn-icon playlist-btn" data-title="' + safeTitle + '" data-url="' + safeUrl + '"></button>'
                        + '</div>';
                }
            }
        ],
        // Rows are re-rendered on every server-side draw, so the play/stop state
        // has to be re-applied to the new buttons.
        drawCallback: function () {
            renderPlayerState();
            renderPlaylistState();
        }
    });

    // Error events don't bubble, so listen on the capture phase: a country with
    // no flag file keeps its slot but shows nothing rather than a broken image.
    document.getElementById('stations-by-countries').addEventListener('error', function (e) {
        if (e.target.classList && e.target.classList.contains('flag')) {
            e.target.style.visibility = 'hidden';
        }
    }, true);

    // Delegated event handlers for dynamically rendered rows
    $('#stations-by-countries tbody').on('click', '.play-btn', function () {
        var url = $(this).data('url');
        if (currentStation && currentStation.url === url) {
            stopPlayback();
        } else {
            playURL(url, $(this).data('title'));
        }
    });
    $('#now-playing-stop').click(function () {
        stopPlayback();
    });

    audioPlayer.addEventListener('playing', function () {
        if (currentStation) {
            setPlayerState('playing');
        }
    });
    audioPlayer.addEventListener('waiting', function () {
        if (currentStation) {
            setPlayerState('loading');
        }
    });
    audioPlayer.addEventListener('error', function () {
        // Clearing the source to stop buffering also fires error; ignore that.
        if (currentStation) {
            reportPlaybackFailure();
        }
    });
    $('#stations-by-countries tbody').on('click', '.playlist-btn', function () {
        var title = $(this).data('title');
        var url = $(this).data('url');
        if (isInPlaylist(title, url)) {
            removeFromNewList(title, url);
        } else {
            addToNewList(title, url);
        }
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

// Flag files are named after the country with spaces as underscores. Only 188 of
// the 228 countries have one; the rest fall back to a blank slot of the same
// size (see the capture-phase error handler) so the names stay aligned.
function flagImage(country) {
    var file = encodeURIComponent(String(country).replace(/ /g, '_') + '.png');
    return '<img class="flag" src="flags/' + file + '" alt="" loading="lazy">';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- Audio ---

function playURL(url, title) {
    currentStation = { url: url, title: title || url };
    setPlayerState('loading');
    audioPlayer.src = url;
    var started = audioPlayer.play();
    // Autoplay rejection and unreachable streams both land here.
    if (started && typeof started.catch === 'function') {
        started.catch(function () {
            reportPlaybackFailure();
        });
    }
}

function stopPlayback() {
    currentStation = null;
    audioPlayer.pause();
    // pause() alone keeps the stream downloading; drop the source to stop it.
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
    setPlayerState('stopped');
}

function reportPlaybackFailure() {
    // A failed stream rejects the play() promise *and* fires an error event.
    // Only the first one through should report, or the toast is overwritten by
    // a second, less specific one.
    if (!currentStation) {
        return;
    }
    var name = currentStation.title;
    currentStation = null;
    audioPlayer.removeAttribute('src');
    setPlayerState('stopped');
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        // titleText, not title: SweetAlert2 renders `title` as HTML, and station
        // names come from the imported directory data rather than from us.
        titleText: name + " can't be played right now.",
        showConfirmButton: false,
        timer: 2500
    });
}

function setPlayerState(state) {
    playerState = currentStation ? state : 'stopped';
    renderPlayerState();
}

// Reflects the player in two places: the row button acting as a play/stop
// toggle, and a banner that stays visible while browsing other pages.
function renderPlayerState() {
    var banner = $('#now-playing');
    if (!currentStation) {
        banner.addClass('hidden');
    } else {
        banner.removeClass('hidden');
        $('#now-playing-name').text(currentStation.title);
        $('#now-playing-status').text(playerState === 'playing' ? 'Now playing' : 'Loading');
    }

    $('#stations-by-countries tbody .play-btn').each(function () {
        var button = $(this);
        var isCurrent = !!currentStation && button.data('url') === currentStation.url;
        var icon = 'play';
        if (isCurrent) {
            icon = playerState === 'loading' ? 'spinner fa-spin' : 'stop';
        }
        button
            .toggleClass('btn-success', !isCurrent)
            .toggleClass('btn-danger', isCurrent)
            .attr('title', isCurrent ? 'Stop' : 'Play')
            .attr('aria-label', isCurrent ? 'Stop' : 'Play')
            .html('<i class="fas fa-' + icon + '"></i>');
    });
}

// --- Playlist management ---

function isInPlaylist(title, url) {
    return newList.some(function (item) {
        return item.title === title && item.url === url;
    });
}

// The browse table doubles as the playlist's membership view: each row shows
// whether that station is already in the list and toggles it.
function renderPlaylistState() {
    $('#stations-by-countries tbody .playlist-btn').each(function () {
        var button = $(this);
        var inList = isInPlaylist(button.data('title'), button.data('url'));
        button
            .toggleClass('btn-primary', !inList)
            .toggleClass('btn-warning', inList)
            .attr('title', inList ? 'Remove from playlist' : 'Add to playlist')
            .attr('aria-label', inList ? 'Remove from playlist' : 'Add to playlist')
            .attr('aria-pressed', inList ? 'true' : 'false')
            .html('<i class="fas fa-' + (inList ? 'check' : 'plus') + '"></i>');
    });
}

function addToNewList(title, url) {
    if (isInPlaylist(title, url)) {
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
    // Keep the browse table's membership badges in step with the playlist.
    renderPlaylistState();

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

        // Ovol is the per-station volume offset YoRadio reads from the third
        // column. Editing mutates the item in place, so no table redraw (and no
        // lost focus) while the user is typing.
        var $ovol = $('<input>')
            .addClass('ovol-input')
            .attr({
                type: 'number',
                min: 0,
                step: 1,
                title: 'Station volume offset',
                'aria-label': 'Volume offset for ' + item.title
            })
            .val(item.Ovol)
            .on('change', function () {
                item.Ovol = normaliseOvol($(this).val());
                $(this).val(item.Ovol);
                savePlaylist();
            });

        table.row.add($('<tr>').append(
            $('<td>').text(item.title),
            $('<td>').addClass('url-cell').attr('title', item.url).text(item.url),
            $('<td>').append($ovol),
            $('<td>').append($('<div class="action-buttons">').append($up, $down, $remove))
        ));
    });
    table.draw();

    // Responsive measures column widths once, and the first measurement happens
    // while the playlist is still empty. Without this the collapse thresholds
    // stay stale and nothing ever moves into the child row on a narrow screen.
    if (table.responsive) {
        table.responsive.recalc();
    }
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
