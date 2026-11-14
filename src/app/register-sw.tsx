"use client";
import { useEffect } from "react";
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("PWA cache registration failed", error));
    }
  }, []);
  return null;
}
