const yts = require('yt-search');

class SearchService {
    async search(query) {
        try {
            console.log(`Searching YouTube for: ${query}`);
            const result = await yts(query);

            // Filter only videos (ignore channels, playlists for now)
            const videos = result.videos.slice(0, 20).map(video => ({
                type: 'video',
                title: video.title,
                url: video.url,
                videoId: video.videoId,
                thumbnail: video.thumbnail,
                duration: video.timestamp,
                author: video.author.name,
                views: video.views
            }));

            return { success: true, results: videos };
        } catch (error) {
            console.error('Error searching YouTube:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new SearchService();
