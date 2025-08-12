/* eslint-disable no-console */
const path = require('path');
const mm = require('music-metadata');

async function readAudioMetadata(filePath) {
    let title = path.basename(filePath, path.extname(filePath));
    let albumName = null; let year = null; let genres = [];
    let artistNames = []; let albumArtistNames = [];
    let durationMs = null; let codec = null; let bitRate = null; let sampleRate = null; let channels = null;
    let comments = null; let rating = null; let trackNo = null; let trackTotal = null; let discNo = null; let discTotal = null; let tagBpm = null; let tagKey = null;

    try {
        const meta = await mm.parseFile(filePath, { duration: true, skipCovers: true });
        const common = meta.common || {};
        const format = meta.format || {};
        if (common.title) title = common.title;
        if (common.album) albumName = common.album;
        if (Array.isArray(common.artists) && common.artists.length > 0) artistNames = common.artists; else if (common.artist) artistNames = [common.artist];
        if (Array.isArray(common.albumartist) && common.albumartist.length > 0) albumArtistNames = common.albumartist; else if (common.albumartist) albumArtistNames = [common.albumartist];
        if (common.genre) genres = Array.isArray(common.genre) ? common.genre : [common.genre];
        if (common.year) year = common.year;
        if (Array.isArray(common.comment) && common.comment.length) comments = common.comment.join('\n');
        if (typeof common.rating === 'number') rating = Math.max(0, Math.min(100, Math.round(common.rating)));
        if (common.track && typeof common.track.no === 'number') trackNo = common.track.no;
        if (common.track && typeof common.track.of === 'number') trackTotal = common.track.of;
        if (common.disk && typeof common.disk.no === 'number') discNo = common.disk.no;
        if (common.disk && typeof common.disk.of === 'number') discTotal = common.disk.of;
        if (typeof common.bpm === 'number') tagBpm = common.bpm;
        if (typeof common.key === 'string') tagKey = common.key;
        if (typeof format.duration === 'number') durationMs = Math.round(format.duration * 1000);
        if (format.codec) codec = String(format.codec);
        if (typeof format.bitrate === 'number') bitRate = Math.round(format.bitrate / 1000);
        if (typeof format.sampleRate === 'number') sampleRate = Math.round(format.sampleRate);
        if (typeof format.numberOfChannels === 'number') channels = format.numberOfChannels;
    } catch (_) {
        // ignore; defaults from filename
    }

    return { title, albumName, year, genres, artistNames, albumArtistNames, durationMs, codec, bitRate, sampleRate, channels, comments, rating, trackNo, trackTotal, discNo, discTotal, tagBpmRaw: tagBpm, tagKeyRaw: tagKey };
}

module.exports = { readAudioMetadata };


