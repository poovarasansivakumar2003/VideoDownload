# Facebook Video Downloader Web App

This web application allows users to download public Facebook videos by providing the video URL. It fetches the video information and provides a direct download link for HD or SD quality.

## Features

- Download public Facebook videos in HD or SD quality.
- Simple REST API backend using Node.js and Express.
- CORS enabled for frontend-backend communication.

## Prerequisites

- [Node.js](https://nodejs.org/) (v12 or higher recommended)
- npm (comes with Node.js)

## Setup

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd facebookVideoDownload
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Start the server:**
   ```
   node server.js
   ```

4. **Access the app:**
   Open your browser and go to [http://localhost:3000](http://localhost:3000)

## API

### POST `/api/download`

**Request Body:**
```json
{
  "url": "https://www.facebook.com/..."
}
```

**Response:**
```json
{
  "videoUrl": "https://...",
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": "00:01:23"
}
```

## Notes

- Only public Facebook videos are supported.
- This app is for educational purposes.

## License

MIT