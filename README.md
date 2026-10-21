# StratisSoft AI Hub

A polished, mobile-responsive launcher page for three existing tools.

## Included
- `index.html` — complete single-file dashboard
- `README.md` — deployment notes

## Deploy on Render as a Static Site
1. Create a new GitHub repository for this hub and upload `index.html` (and this README if desired).
2. In Render, choose **New → Static Site** and connect that repository.
3. Set the publish directory to `.` (the repository root). No build command is required.
4. Deploy. Render will provide a site address for the hub.

## Important URL note
The dashboard does not print the destination URLs as visible text; users see branded cards and buttons. When a button is clicked, the destination service's URL will normally appear in the browser address bar in the new tab. A custom domain can give the hub a branded address, but it does not automatically hide the addresses of the separate tools. Embedding tools inside the hub is not guaranteed to work because those apps may block iframe embedding or depend on their own navigation/session behavior.

This hub only links to the three existing services. It does not modify or delete them.
