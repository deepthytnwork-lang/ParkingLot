
Setup: `createdb parking && psql parking -f schema.sql && npm i && npm start`

| Method | Path | Body | Purpose |
|---|---|---|---|
| POST | /check-in | `{plate, type}` | Allocates spot, returns ticket |
| POST | /check-out | `{ticketId}` | Computes fee, frees spot |
| GET | /availability | – | Free/total spots per size |
| GET | /availability/stream | – | SSE live updates |


