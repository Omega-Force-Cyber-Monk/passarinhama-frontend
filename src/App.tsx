import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import SessionInitializer from './components/SessionInitializer';

export default function App() {
  return <><SessionInitializer /><RouterProvider router={router} /></>;
}
