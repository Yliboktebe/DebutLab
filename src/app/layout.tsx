import { Outlet } from 'react-router-dom';
import './layout.css';

export function Layout() {
  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <h1 className="logo">
            <a href="/">DebutLab</a>
          </h1>
          <p className="subtitle">Тренажёр шахматных дебютов</p>
        </div>
      </header>
      
      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>
      
      <footer className="footer">
        <div className="container">
          <p>&copy; 2025 DebutLab. Тренажёр шахматных дебютов.</p>
        </div>
      </footer>
    </div>
  );
}
