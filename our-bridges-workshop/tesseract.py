import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import hashlib

# ---- Tesseract Geometry ---- #
def generate_tesseract_vertices():
    return np.array([[int(b) for b in format(i, '04b')] for i in range(16)])

def generate_edges(vertices):
    edges = []
    for i in range(len(vertices)):
        for j in range(i+1, len(vertices)):
            if np.sum(np.abs(vertices[i] - vertices[j])) == 1:
                edges.append((i, j))
    return edges

# ---- 4D Rotation ---- #
def rotate_4d(points, angle):
    def rot(a, i, j):
        r = np.eye(4)
        c, s = np.cos(a), np.sin(a)
        r[[i, i, j, j], [i, j, i, j]] = c, -s, s, c
        return r
    R = rot(angle, 0, 1) @ rot(angle * 1.3, 2, 3) @ rot(angle * 0.7, 0, 2) @ rot(angle * 1.7, 1, 3)
    return points @ R.T

def project_4d_to_3d(points4D):
    w = points4D[:, 3] + 3.5
    return points4D[:, :3] / w[:, np.newaxis]

# ---- Setup ---- #
vertices4D = generate_tesseract_vertices()
edges = generate_edges(vertices4D)

# ---- Plotting ---- #
fig = plt.figure(figsize=(8, 8))
ax = fig.add_subplot(111, projection='3d')
fig.patch.set_facecolor('black')
ax.set_facecolor('black')

angle = 0.0

def init():
    ax.set_xlim(-2, 2)
    ax.set_ylim(-2, 2)
    ax.set_zlim(-2, 2)
    ax.axis('off')
    return []

def update(frame):
    global angle
    ax.clear()
    ax.set_facecolor('black')
    ax.set_xlim(-2, 2)
    ax.set_ylim(-2, 2)
    ax.set_zlim(-2, 2)
    ax.axis('off')

    angle += 0.02
    rotated = rotate_4d(vertices4D, angle)
    projected = project_4d_to_3d(rotated)

    for i, j in edges:
        ax.plot(*zip(projected[i], projected[j]), color='cyan', linewidth=2.0, alpha=0.9)

    ax.scatter(projected[:, 0], projected[:, 1], projected[:, 2], c='white', s=10)
    return []

anim = FuncAnimation(fig, update, init_func=init, interval=40, blit=False, cache_frame_data=False)
plt.show()
