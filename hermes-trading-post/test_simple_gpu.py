"""
Simple ModernGL test to check GPU availability
"""
try:
    import moderngl
    print("✅ ModernGL imported successfully")
    
    # Test creating a context
    import pygame
    pygame.init()
    print("✅ Pygame initialized")
    
    # Create a hidden window for OpenGL context
    pygame.display.set_mode((100, 100), pygame.OPENGL | pygame.DOUBLEBUF | pygame.HIDDEN)
    print("✅ Pygame display created")
    
    # Create ModernGL context
    ctx = moderngl.create_context()
    print(f"✅ ModernGL context created: {ctx}")
    print(f"GPU Info: {ctx.info}")
    
    ctx.release()
    pygame.quit()
    print("✅ GPU charts are ready!")
    
except Exception as e:
    print(f"❌ GPU test failed: {e}")
    import traceback
    traceback.print_exc()
    
    print("\n🔧 Troubleshooting:")
    print("1. Make sure you have OpenGL drivers installed")
    print("2. Try: pip install --upgrade moderngl pygame")
    print("3. Check if your system supports OpenGL 3.3+")
