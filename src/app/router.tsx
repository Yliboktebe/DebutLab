import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './layout';
import { HomePage } from '@/pages/HomePage';
import { DebutPage } from '@/pages/DebutPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'debut/:id',
        element: <DebutPage />,
      },
    ],
  },
]);
