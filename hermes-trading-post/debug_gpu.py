"""
Debug ModernGL with verbose output
"""
import sys
print("Starting GPU test...")
print(f"Python version: {sys.version}")

try:
    print("Step 1: Testing basic imports...")
    import moderngl
    print("✅ ModernGL imported")
    
    import pygame
    print("✅ Pygame imported")
    
    import numpy as np
    print("✅ NumPy imported")
    
    from PIL import Image
    print("✅ PIL imported")
    
    print("\nStep 2: Testing pygame initialization...")
    pygame.init()
    print("✅ Pygame initialized")
    
    print("\nStep 3: Testing display creation...")
    # Try to create a display
    try:
        screen = pygame.display.set_mode((100, 100), pygame.OPENGL | pygame.DOUBLEBUF | pygame.HIDDEN)
        print("✅ Pygame OpenGL display created")
    except Exception as e:
        print(f"❌ Display creation failed: {e}")
        # Try without OpenGL
        screen = pygame.display.set_mode((100, 100), pygame.HIDDEN)
        print("⚠️  Fallback display created (no OpenGL)")
        raise
    
    print("\nStep 4: Testing ModernGL context...")
    try:
        ctx = moderngl.create_context()
        print(f"✅ ModernGL context created")
        print(f"GPU Vendor: {ctx.info.get('GL_VENDOR', 'Unknown')}")
        print(f"GPU Renderer: {ctx.info.get('GL_RENDERER', 'Unknown')}")
        print(f"OpenGL Version: {ctx.info.get('GL_VERSION', 'Unknown')}")
        
        ctx.release()
        print("✅ Context released")
        
    except Exception as e:
        print(f"❌ ModernGL context failed: {e}")
        raise
    
    pygame.quit()
    print("\n🎉 GPU charts are fully supported!")
    
except Exception as e:
    print(f"\n❌ GPU test failed at: {e}")
    import traceback
    traceback.print_exc()
    
    print("\n🔧 Possible solutions:")
    print("1. Update graphics drivers")
    print("2. Install OpenGL libraries: pip install PyOpenGL PyOpenGL_accelerate")
    print("3. For headless servers, install virtual display: sudo apt-get install xvfb")
    print("4. Try software rendering: export MESA_GL_VERSION_OVERRIDE=3.3")

print("\nTest completed.")
