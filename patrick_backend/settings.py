"""
Django Settings — Patrick's Asset Valuation & Depreciation Backend

This is the central configuration file for Patrick's DRF backend.
It configures:
  - Installed apps (Django built-ins + 3rd party + our custom apps)
  - Database (PostgreSQL via environment variables)
  - REST Framework (default authentication, permissions, pagination)
  - JWT authentication (using djangorestframework-simplejwt)
  - CORS (allowing React frontend at port 3000 to call this API)
  - Static and media files

"""

from pathlib import Path
from datetime import timedelta
from decouple import config, Csv


# BASE DIRECTORY
# This is the root folder containing manage.py
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY SETTINGS — pulled from .env file (never hardcoded)
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost', cast=Csv())

# INSTALLED APPLICATIONS
INSTALLED_APPS = [
    # Django built-in apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps for API functionality
    'rest_framework',                            # Django REST Framework — turns Django into an API server
    'rest_framework_simplejwt',                  # JWT authentication for token-based login
    'rest_framework_simplejwt.token_blacklist',  # Lets us blacklist refresh tokens on logout
    'corsheaders',              # CORS — allows React to call our API from a different port
    'django_filters',            # For filtering querysets in API views
    # Our custom apps (the system's actual functionality)
    'users',         # Unified User model + role-based auth
    'assets',        # Asset registration, valuation, lifecycle event tracking
    'depreciation',  # Depreciation policy + schedule generation
    'reports',       # Financial reports (valuation, depreciation, lease, revenue, budget)
    'integration',   # External integration endpoints (X-API-Key)

    # Lease + finance side (merged from the ASSET project)
    'tenants',
    'properties',
    'leases',
    'invoices',
    'payments',
    'budgets',
    'notifications',
]

# MIDDLEWARE — request/response processing pipeline
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',                  # MUST be near the top — handles CORS
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# URL CONFIGURATION
ROOT_URLCONF = 'patrick_backend.urls'

# TEMPLATES — Django still uses these for the admin panel
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'patrick_backend.wsgi.application'

# DATABASE — PostgreSQL configuration from .env file
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',  # PostgreSQL adapter
        'NAME': config('DB_NAME'),                  # Database name
        'USER': config('DB_USER'),                  # Database user
        'PASSWORD': config('DB_PASSWORD'),          # Database password
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),  # PostgreSQL default port
    }
}

# CUSTOM USER MODEL
# We use our own User model from the 'users' app instead of Django's default.
# This lets us add a 'role' field and other custom fields.
AUTH_USER_MODEL = 'users.User'

# PASSWORD VALIDATION
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
# LOCALIZATION
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Dar_es_Salaam'  # Tanzania time zone
USE_I18N = True
USE_TZ = True

# STATIC AND MEDIA FILES
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# DJANGO REST FRAMEWORK CONFIGURATION

REST_FRAMEWORK = {
    # Default authentication — every API request must include a JWT token
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),

    # Default permission — every endpoint requires the user to be authenticated
    # (we'll override this on the login/register endpoints to allow public access)
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),

    # Pagination is disabled globally so list endpoints return plain
    # arrays (which is what the ASSET-side pages expect). Individual
    # viewsets can still opt in with `pagination_class = PageNumberPagination`.
    # 'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    # 'PAGE_SIZE': 20,

    # Date format used in all API responses
    'DATETIME_FORMAT': '%Y-%m-%d %H:%M:%S',
    'DATE_FORMAT': '%Y-%m-%d',
}

# JWT (JSON Web Token) CONFIGURATION
# JWTs are signed tokens the React frontend sends with every API request.
# - ACCESS token: short-lived (60 minutes) — used for actual API calls
# - REFRESH token: long-lived (7 days) — used to get a new access token
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
    ),
    'ROTATE_REFRESH_TOKENS': True,            # Issue new refresh token on each refresh
    'BLACKLIST_AFTER_ROTATION': True,         # Old refresh tokens become invalid
    'UPDATE_LAST_LOGIN': True,                # Track when user last logged in

    'ALGORITHM': 'HS256',                     # Signing algorithm
    'SIGNING_KEY': SECRET_KEY,                # Uses Django's secret key to sign tokens

    'AUTH_HEADER_TYPES': ('Bearer',),         # Frontend sends: Authorization: Bearer <token>

    'USER_ID_FIELD': 'id',                    # Field on User model to identify the user
    'USER_ID_CLAIM': 'user_id',
}

# CORS CONFIGURATION
# Allow React frontend (running on http://localhost:3000) to call this API
# without browser blocking the request.
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', cast=Csv())

# Allow credentials (cookies, authorization headers) in CORS requests
CORS_ALLOW_CREDENTIALS = True

# Allowed HTTP methods
CORS_ALLOW_METHODS = [
    'DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]

# Allowed headers
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]


# EMAIL (used for password reset + new-user credentials + tenant notifications)
# Overridable via .env. Default is Gmail SMTP with the built-in app password.
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='byteujamaa1@gmail.com')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='kzat ofxx jcfw juit')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER or 'noreply@asset.local')
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=15, cast=int)

# In DEBUG with no password configured, print emails to the console instead
# of trying (and failing) to hit an SMTP server.
if DEBUG and not EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# Frontend URL — used in password reset emails
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')

# Shared integration key kept for backwards compatibility with the old
# HTTP-based ASSET → Patrick integration (no longer used post-merge).
INTEGRATION_API_KEY = config(
    'INTEGRATION_API_KEY',
    default='asset-integration-key-change-in-production',
)