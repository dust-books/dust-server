# Dust Client

A modern web client for the Dust media server, built with Lit and TypeScript.

## Features

### ✅ Implemented
- **Modern Web Components**: Built with Lit for fast, reactive UI components
- **TypeScript**: Full type safety and excellent developer experience
- **Authentication**: Login/register with JWT token management
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Automatic theme detection with manual override
- **Toast Notifications**: User-friendly notifications for actions and errors
- **Library View**: Grid and list views for browsing books
- **State Management**: Centralized app state with reactive updates

### 🚧 In Development
- **Book Reader**: EPUB/PDF reading with customizable settings
- **Reading Progress**: Sync reading progress across devices
- **Profile Management**: Edit user profile and preferences
- **Admin Dashboard**: User and library management interface

### 📋 Planned
- **Advanced Search**: Full-text search with filters
- **Bookmarks & Notes**: Save favorite passages and add notes
- **Reading Statistics**: Detailed analytics and reading streaks
- **Social Features**: Reading lists and recommendations
- **Offline Reading**: Download books for offline access

## Getting Started

### Prerequisites

- Node.js 18+ (or compatible runtime)
- Dust server running on `http://localhost:4001`

### Installation

1. **Install dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Development

### Project Structure

```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── auth/           # Authentication components
│   │   ├── layout/         # Layout components (header, sidebar, etc.)
│   │   └── pages/          # Page-level components
│   ├── services/           # API and state management
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── index.html              # Main HTML file
├── vite.config.ts         # Vite configuration
└── package.json           # Dependencies and scripts
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking

### API Integration

The client communicates with the Dust server through the `ApiService` class:

```typescript
import { apiService } from './services/api.js';

// Login
await apiService.login({ email, password });

// Get books
const books = await apiService.getBooks();

// Update reading progress
await apiService.updateReadingProgress(bookId, currentPage, totalPages);
```

### State Management

The app uses Lit's Context API for state management:

```typescript
import { appState } from './services/app-state.js';

// Access current state
const state = appState.getState();

// Subscribe to changes
const unsubscribe = appState.subscribe(() => {
  // Handle state changes
});

// Update state through actions
await appState.login(email, password);
await appState.loadBooks();
```

### Component Development

Components are built with Lit web components:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-component')
export class MyComponent extends LitElement {
  @property({ type: String })
  title = '';

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }
  `;

  render() {
    return html`
      <h1>${this.title}</h1>
    `;
  }
}
```

### Styling

The app uses CSS custom properties for theming:

```css
:root {
  --primary-color: #6366f1;
  --background-color: #ffffff;
  --text-color: #1f2937;
  /* ... */
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --background-color: #0f172a;
    --text-color: #f1f5f9;
    /* ... */
  }
}
```

## Configuration

### Server URL

By default, the client expects the Dust server at `http://localhost:4001`. To change this:

1. **Development**: Update the `proxy` configuration in `vite.config.ts`
2. **Production**: Set the `VITE_API_URL` environment variable

### Authentication

The client stores JWT tokens in localStorage and automatically includes them in API requests. Tokens are cleared on logout or authentication errors.

## Deployment

### Static Hosting

The built client is a static web application that can be hosted on any static hosting service:

1. Build the application: `npm run build`
2. Upload the `dist/` directory to your hosting service
3. Configure your web server to serve `index.html` for all routes (SPA routing)

### Docker

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

- `VITE_API_URL` - Base URL for the Dust server API
- `VITE_APP_TITLE` - Application title (default: "Dust")

## Browser Support

- Chrome/Chromium 88+
- Firefox 78+
- Safari 14+
- Edge 88+

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Write components as Lit web components
4. Test on multiple screen sizes
5. Update this README for new features

## License

Same as the main Dust project.