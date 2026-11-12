import { IconButton } from "@radix-ui/themes";
import { ArrowUp } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="ai-credit">
        <svg aria-hidden="true" className="slop-stamp" viewBox="0 0 84 28">
          <g fill="none" stroke="currentColor" transform="rotate(-3 42 14)">
            <rect height="25" rx="5" strokeWidth="1.8" width="81" x="1.5" y="1.5" />
            <rect height="20" rx="3.5" strokeDasharray="1.5 2.2" strokeWidth="1.2" width="76" x="4" y="4" />
          </g>
          <g fill="currentColor" textAnchor="middle" transform="rotate(-3 42 14)">
            <text x="42" y="17">100% SLOP</text>
          </g>
        </svg>
      </span>
      <a className="github-link" href="https://github.com/jdel/mtg" rel="noreferrer" target="_blank">
        Fork me
        <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297z"
            fill="currentColor"
          />
        </svg>
      </a>
      <a
        aria-label="Magic: The Gathering card designs and related materials are property of Wizards of the Coast"
        className="wizards-notice"
        href="https://company.wizards.com/en/legal/fancontentpolicy"
        rel="noreferrer"
        target="_blank"
      >
        Card designs © Wizards
      </a>
      <IconButton
        aria-label="Scroll to top of card list"
        className="scroll-top-button"
        color="gray"
        onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })}
        size="1"
        variant="ghost"
      >
        <ArrowUp aria-hidden="true" size={15} />
      </IconButton>
    </footer>
  );
}
