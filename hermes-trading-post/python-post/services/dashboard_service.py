# filepath: d:\Github\alpaca-trader\services\dashboard_service.py
"""
Dashboard Layout Service for managing persistent dashboard configurations
"""
import json
import hashlib
import sys
import os
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

# Add backend to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(os.path.dirname(current_dir), 'backend')
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.models.dashboard_layout import DashboardLayout, DashboardComponent
from app.core.database import SessionLocal, get_db


class DashboardLayoutService:
    """Service for managing dashboard layouts and components"""
    
    def __init__(self):
        pass
    
    def _get_session_id(self) -> str:
        """Generate a stable session ID for layout persistence across server restarts"""
        try:
            import streamlit as st
            
            # Use a persistent session ID stored in session state
            if hasattr(st.session_state, 'persistent_session_id'):
                return st.session_state.persistent_session_id
            else:
                # For now, use a fixed session ID so layouts persist across restarts
                # In production, this could be based on user login or browser fingerprint
                persistent_id = "default_user_session"
                st.session_state.persistent_session_id = persistent_id
                return persistent_id
        except ImportError:
            # Fallback for non-Streamlit environments
            return "default_session"
    
    def save_layout(self, dashboard_name: str, layout_data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
        """
        Save dashboard layout to database
        
        Args:
            dashboard_name: Name of the dashboard (e.g., "test_drag_drop", "backtesting")
            layout_data: Layout configuration data
            user_id: Optional user ID for multi-user support
        
        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            db = SessionLocal()
            session_id = self._get_session_id()
            
            # Check if layout already exists
            existing_layout = db.query(DashboardLayout).filter(
                DashboardLayout.dashboard_name == dashboard_name,
                DashboardLayout.session_id == session_id,
                DashboardLayout.user_id == user_id
            ).first()
            
            if existing_layout:
                # Update existing layout
                existing_layout.set_layout_dict(layout_data)
                existing_layout.is_active = True
            else:
                # Create new layout
                new_layout = DashboardLayout(
                    dashboard_name=dashboard_name,
                    user_id=user_id,
                    session_id=session_id,
                    is_active=True,
                    description=f"Layout for {dashboard_name} dashboard"
                )
                new_layout.set_layout_dict(layout_data)
                db.add(new_layout)
            
            db.commit()
            db.close()
            return True
            
        except Exception as e:
            print(f"Error saving layout: {e}")
            if 'db' in locals():
                db.rollback()
                db.close()
            return False
    
    def load_layout(self, dashboard_name: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Load dashboard layout from database
        
        Args:
            dashboard_name: Name of the dashboard
            user_id: Optional user ID for multi-user support
        
        Returns:
            Dict[str, Any]: Layout configuration data or None if not found
        """
        try:
            db = SessionLocal()
            session_id = self._get_session_id()
            
            # Try to find layout for current session/user
            layout = db.query(DashboardLayout).filter(
                DashboardLayout.dashboard_name == dashboard_name,
                DashboardLayout.session_id == session_id,
                DashboardLayout.user_id == user_id,
                DashboardLayout.is_active == True
            ).first()
            
            if layout:
                result = layout.get_layout_dict()
                db.close()
                return result
            
            db.close()
            return None
            
        except Exception as e:
            print(f"Error loading layout: {e}")
            if 'db' in locals():
                db.close()
            return None
    
    def reset_layout(self, dashboard_name: str, user_id: Optional[str] = None) -> bool:
        """
        Reset dashboard layout by marking it as inactive
        
        Args:
            dashboard_name: Name of the dashboard
            user_id: Optional user ID for multi-user support
        
        Returns:
            bool: True if reset successfully, False otherwise
        """
        try:
            db = SessionLocal()
            session_id = self._get_session_id()
            
            # Find and deactivate existing layouts
            layouts = db.query(DashboardLayout).filter(
                DashboardLayout.dashboard_name == dashboard_name,
                DashboardLayout.session_id == session_id,
                DashboardLayout.user_id == user_id
            ).all()
            
            for layout in layouts:
                layout.is_active = False
            
            db.commit()
            db.close()
            return True
            
        except Exception as e:
            print(f"Error resetting layout: {e}")
            if 'db' in locals():
                db.rollback()
                db.close()
            return False
    
    def list_layouts(self, dashboard_name: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List saved dashboard layouts
        
        Args:
            dashboard_name: Optional dashboard name filter
            user_id: Optional user ID filter
        
        Returns:
            List[Dict[str, Any]]: List of layout metadata
        """
        try:
            db = SessionLocal()
            session_id = self._get_session_id()
            
            query = db.query(DashboardLayout).filter(
                DashboardLayout.session_id == session_id,
                DashboardLayout.is_active == True
            )
            
            if dashboard_name:
                query = query.filter(DashboardLayout.dashboard_name == dashboard_name)
            if user_id:
                query = query.filter(DashboardLayout.user_id == user_id)
            
            layouts = query.all()
            
            result = []
            for layout in layouts:
                result.append({
                    'id': layout.id,
                    'dashboard_name': layout.dashboard_name,
                    'user_id': layout.user_id,
                    'session_id': layout.session_id,
                    'description': layout.description,
                    'created_at': layout.created_at,
                    'updated_at': layout.updated_at
                })
            
            db.close()
            return result
            
        except Exception as e:
            print(f"Error listing layouts: {e}")
            if 'db' in locals():
                db.close()
            return []


# Global instance for easy access
dashboard_service = DashboardLayoutService()
