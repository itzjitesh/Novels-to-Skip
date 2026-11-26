import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import { ToastProvider } from "./lib/toast.jsx";
import Layout, { RequireAuth } from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import BookPage from "./pages/BookPage.jsx";
import { Login, Register } from "./pages/Auth.jsx";
import About from "./pages/About.jsx";
import NotFound from "./pages/NotFound.jsx";

// Heavier, logged-in-only pages load on demand.
const WriteBook = lazy(() => import("./pages/WriteBook.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Library = lazy(() => import("./pages/Library.jsx"));
const Submissions = lazy(() => import("./pages/Submissions.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

const auth = (el, admin) => <RequireAuth admin={admin}>{el}</RequireAuth>;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="books" element={<Explore />} />
                <Route path="books/:slug" element={<BookPage />} />
                <Route path="books/:slug/edit" element={auth(<WriteBook mode="edit" />)} />
                <Route path="books/:slug/suggest" element={auth(<WriteBook mode="suggest" />)} />
                <Route path="write" element={auth(<WriteBook mode="create" />)} />
                <Route path="u/:username" element={<Profile />} />
                <Route path="me/library" element={auth(<Library />)} />
                <Route path="me/submissions" element={auth(<Submissions />)} />
                <Route path="me/settings" element={auth(<Settings />)} />
                <Route path="admin/*" element={auth(<Admin />, true)} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
