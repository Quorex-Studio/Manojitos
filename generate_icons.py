import os
import sys

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def generate_icons(source_image, output_dir):
    try:
        img = Image.open(source_image)
    except Exception as e:
        print(f"Error opening image: {e}")
        return

    # Sizes needed
    # favicon.ico (16x16, 32x32, 48x48)
    # apple-touch-icon.png (180x180)
    # favicon-32x32.png
    # favicon-16x16.png
    # android-chrome-192x192.png
    # android-chrome-512x512.png

    # Convert to RGBA to handle transparency correctly if needed
    img = img.convert("RGBA")

    # Make apple-touch-icon
    apple_img = img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_img.save(os.path.join(output_dir, "apple-touch-icon.png"))

    # Make 32x32 and 16x16
    img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    img_32.save(os.path.join(output_dir, "favicon-32x32.png"))

    img_16 = img.resize((16, 16), Image.Resampling.LANCZOS)
    img_16.save(os.path.join(output_dir, "favicon-16x16.png"))

    # Make android icons
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save(os.path.join(output_dir, "android-chrome-192x192.png"))

    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(os.path.join(output_dir, "android-chrome-512x512.png"))

    # Make favicon.ico
    # A single ico can contain multiple sizes
    img.save(os.path.join(output_dir, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    print("Icons generated successfully!")

if __name__ == "__main__":
    generate_icons("public/logo.jpeg", "public")
