import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'

// Chessground styles - правильные импорты согласно инструкции
import '@lichess-org/chessground/assets/chessground.base.css';     // базовая разметка доски
import '@lichess-org/chessground/assets/chessground.cburnett.css'; // набор фигур «cburnett»
import '@lichess-org/chessground/assets/chessground.brown.css';    // тема клеток

import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
