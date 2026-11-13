import '../app.css';
import { mountGame } from '../src/app.mjs';
import { initializeMapp } from './adapter.mjs';

// The adapter renders failures and always reports lifecycle readiness.
initializeMapp({ render: (transport, environment) => mountGame(transport, environment) }).catch(() => {});
