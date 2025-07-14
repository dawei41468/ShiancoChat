# User Authentication Feature Plan

This plan outlines the necessary changes for both the backend and frontend to implement a secure, email-and-password-based authentication system.

## 1. Backend Architecture

The backend will handle user registration, password management, and token-based authentication.

*   **Data Model (`User`):** A new collection `users` will be created in MongoDB with the following schema:
    *   `id`: UUID (Primary Key)
    *   `name`: String
    *   `email`: String (Unique, Indexed)
    *   `hashed_password`: String
    *   `department`: String (Enum: e.g., "Engineering", "Sales", "Marketing", "HR")
    *   `role`: String (Enum: "User", "Admin")
    *   `created_at`: DateTime
*   **Security:**
    *   **Password Hashing:** We will use `passlib` with the `bcrypt` algorithm to securely hash and verify passwords. This is a standard, secure practice that never stores plain-text passwords.
    *   **Authentication:** We will use JSON Web Tokens (JWT) for managing user sessions. A signed JWT will be issued upon successful login and will be required for all protected API endpoints.
*   **API Endpoints:** A new router will be created for authentication (`/api/auth`).
    *   `POST /api/auth/register`: Creates a new user.
    *   `POST /api/auth/login`: Authenticates a user and returns a JWT access token.
    *   `GET /api/users/me`: A protected endpoint that returns the current authenticated user's information.
*   **Dependencies:** The following libraries will be added to `backend/requirements.txt`: `passlib[bcrypt]`, `python-jose`.

## 2. Frontend Architecture

The frontend will be updated with new pages for login/registration, protected routing, and global state management for authentication.

*   **Pages & Components:**
    *   `LoginPage.js`: A new page with a form for email and password.
    *   `RegisterPage.js`: A new page with a form for name, email, password, and a dropdown for `department`.
*   **Routing:**
    *   The main routing in `App.js` will be updated to include public routes (`/login`, `/register`) and protected routes (e.g., `/`, `/settings`).
    *   Unauthenticated users attempting to access a protected route will be redirected to `/login`.
*   **State Management (`AuthContext`):**
    *   A new `AuthContext` will be created to manage the authentication state (JWT token, user data) throughout the application.
    *   This context will provide `login`, `logout`, and `register` functions that interact with the backend API.
*   **API Service:**
    *   The `apiService.js` will be updated with functions to call the new `/api/auth` endpoints.
    *   The `axios` client will be configured to automatically include the JWT in the `Authorization` header for all requests to protected endpoints.

## 3. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend

    User->>Frontend: Visits App
    Frontend-->>User: Redirects to /login

    User->>Frontend: Clicks "Create Account"
    Frontend-->>User: Shows /register page

    User->>Frontend: Submits registration form
    Frontend->>Backend: POST /api/auth/register with user data
    Backend->>Backend: Hashes password, creates User in DB
    Backend-->>Frontend: Returns success message

    User->>Frontend: Submits login form
    Frontend->>Backend: POST /api/auth/login with credentials
    Backend->>Backend: Verifies credentials, generates JWT
    Backend-->>Frontend: Returns JWT access token

    Frontend->>Frontend: Stores JWT, updates AuthContext
    Frontend-->>User: Redirects to main chat page (/)

    User->>Frontend: Accesses a protected resource
    Frontend->>Backend: API request with "Authorization: Bearer <JWT>"
    Backend->>Backend: Verifies JWT
    Backend-->>Frontend: Returns protected data