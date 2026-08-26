"use client";

import { useEffect, useState } from "react";

function computeGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Time-of-day greeting based on the visitor's clock. The server-rendered
 * value (server timezone) is used for the initial paint, then corrected to
 * the browser's local time after mount — so it stays right when the app is
 * deployed to a server in another timezone.
 */
export function Greeting({ name, initial }: { name: string; initial: string }) {
  const [greeting, setGreeting] = useState(initial);
  useEffect(() => {
    setGreeting(computeGreeting(new Date().getHours()));
  }, []);
  return (
    <>
      {greeting}, {name}
    </>
  );
}
