import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import User

security = HTTPBearer()

import os
import json

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        import base64
        b64_env = os.environ.get("FIREBASE_ADMINSDK_BASE64")
        json_env = os.environ.get("FIREBASE_ADMINSDK_JSON")
        
        if b64_env:
            cred_dict = json.loads(base64.b64decode(b64_env).decode('utf-8'))
            cred = credentials.Certificate(cred_dict)
        elif json_env:
            # Fix potential Vercel escaping issues
            cred_dict = json.loads(json_env.replace('\\n', '\n'), strict=False)
            cred = credentials.Certificate(cred_dict)
        else:
            cred = credentials.Certificate("firebase-adminsdk.json")
            
        firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Warning: Firebase initialization failed. Ensure credentials are set: {e}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        if not uid or not email:
            print("Auth error: Missing uid or email in decoded token")
            raise credentials_exception
    except Exception as e:
        print(f"Auth verification failed! Detailed Error: {e}")
        raise credentials_exception

    user = await User.find_one(User.email == email)
    if not user:
        # Default admin rule
        role = "admin" if email == "sumedhnavuda007@gmail.com" else "user"
        user = User(
            username=email.split("@")[0],
            email=email,
            role=role,
        )
        await user.insert()
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
        
    return user

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
