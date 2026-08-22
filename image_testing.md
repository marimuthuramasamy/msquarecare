# Image rules for AI analysis (enforced before sending to Gemini)
- Accepted MIME types: image/jpeg, image/png, image/webp only.
- Backend resizes to max 1280px and re-encodes to JPEG (quality 85) via Pillow.
- For animated images, only frame 1 is used.
- Blank/solid-colour images are not meaningful.
- Endpoint: POST /api/analyze-image (multipart: file, context).
