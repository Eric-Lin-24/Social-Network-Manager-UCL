from PIL import Image
import numpy as np

src = r"c:\Users\Yusuf\AppData\Roaming\Code\User\globalStorage\github.copilot-chat\copilot-cli-images\1773756111065-xe9k1yb5.png"
dst = r"c:\Users\Yusuf\Documents\GitHub\project\actualZaploopa\Social-Network-Manager-UCL\assets\tray-icon.png"

img = Image.open(src).convert("RGBA")
data = np.array(img)

r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# The background is dark navy blue (~10,14,35 or similar)
# Remove pixels that are dark blue/navy (the outer background)
# Background detection: low R, low-medium G, medium B, and dark overall
bg_mask = (r.astype(int) < 40) & (g.astype(int) < 40) & (b.astype(int) < 70)

# Also remove the slightly lighter outer glow/shadow around the rounded rect
# by detecting near-navy pixels
bg_mask2 = (r.astype(int) < 25) & (g.astype(int) < 30) & (b.astype(int) < 60)

# Combine
mask = bg_mask | bg_mask2

data[:,:,3] = np.where(mask, 0, data[:,:,3])

result = Image.fromarray(data)
result.save(dst)
print("Saved to", dst)
print("Image size:", result.size)
