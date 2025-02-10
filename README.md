# API for lain.ovh  
Backend API for handling [comments, authentication, etc.].\
Built with Node.js, Express, SQLite, and other dependencies.  

## Instructions on how to run it  
1. Clone this repository:  
   `git clone https://github.com/zfi2/api.lain.ovh`  
2. Install dependencies:  
   `npm install`  
3. Set up environment variables:  
    - `SERVER_USERNAME`: The reserved username (case insensitive).  
    - `SERVER_PASSWORD_HASH`: The bcrypt-hashed password for the admin user.  

4. Run the server:
    `node server.js`

**For the frontend part, check out [lain.ovh](https://github.com/zfi2/lain.ovh)**  