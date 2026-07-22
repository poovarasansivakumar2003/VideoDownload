from flask import Flask, render_template, request, flash, redirect, url_for
import yt_dlp

app = Flask(__name__)
app.secret_key = "supersecretkey"

@app.route("/", methods=["GET", "POST"])
def index():
    video_info = None

    if request.method == "POST":
        url = request.form.get("url")

        if not url:
            flash("Please enter a YouTube URL.", "error")
            return redirect(url_for("index"))

        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'quiet': True,
            'no_warnings': True,
            'cookiefile': 'cookies.txt',
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'mweb', 'web_creator'],
                    'player_skip': ['webpage', 'configs'],
                }
            }
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Extract basic metadata and the direct download URL
                video_info = {
                    "title": info.get("title"),
                    "thumbnail": info.get("thumbnail"),
                    "duration": info.get("duration_string"),
                    "download_url": info.get("url"), # Direct stream link
                }
        except Exception as e:
            flash(f"Error processing video: {str(e)}", "error")

    return render_template("index.html", video=video_info)

if __name__ == "__main__":
    app.run(debug=True, port=5000)