import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useRef, useState, type DragEvent } from "react";
import { MAX_UPLOAD_BYTES, type UploadResponse } from "../../lib/apiTypes";
import { api } from "../api";
import { QualityReport } from "../components/QualityReport";
import { date } from "../format";
import { tokens } from "../theme";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; filename: string }
  | { status: "done"; result: UploadResponse }
  | { status: "error"; filename: string; message: string };

const REQUIRED_COLUMNS = "service_id, service_name, timestamp, status_code, latency, latency_unit, agent, region";

export function UploadView({ onOpenDataset }: { onOpenDataset: (datasetId: string) => void }) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setState({ status: "error", filename: file.name, message: `The file is ${mb} MB; the limit is 4 MB.` });
      return;
    }
    setState({ status: "uploading", filename: file.name });
    try {
      setState({ status: "done", result: await api.upload(file) });
    } catch (err) {
      setState({ status: "error", filename: file.name, message: (err as Error).message });
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void upload(file);
  }

  const busy = state.status === "uploading";

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Typography variant="h1" sx={{ fontSize: "1.5rem", mb: 1 }}>
        Upload health checks
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        A CSV with one row per check and the columns {REQUIRED_COLUMNS}, up to 4 MB. It's cleaned and saved as a
        new dataset; uploading the same file again opens the saved one.
      </Typography>

      <Box
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          px: 3,
          py: 5,
          textAlign: "center",
          bgcolor: dragging ? "#E8F1F3" : tokens.surface,
          border: `1.5px dashed ${dragging ? tokens.petrol : tokens.grid}`,
          borderRadius: 1,
        }}
      >
        <UploadFileOutlinedIcon sx={{ fontSize: 36, color: tokens.muted }} />
        <Typography>Drop a CSV file here, or</Typography>
        <Button variant="contained" disabled={busy} onClick={() => input.current?.click()}>
          Choose a file
        </Button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ""; // allow choosing the same file again
            if (file) void upload(file);
          }}
        />
      </Box>

      <Box aria-live="polite" sx={{ mt: 3 }}>
        {state.status === "uploading" && (
          <Box>
            <Typography sx={{ mb: 1 }}>Cleaning and saving {state.filename}…</Typography>
            <LinearProgress />
          </Box>
        )}

        {state.status === "error" && (
          <Alert severity="error">
            Couldn't upload {state.filename}. {state.message}
          </Alert>
        )}

        {state.status === "done" && (
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              {state.result.alreadyUploaded
                ? `${state.result.dataset.filename} was already uploaded on ${date(state.result.dataset.uploadedAt)}. Nothing new was saved.`
                : `Saved ${state.result.dataset.filename}.`}
            </Typography>
            <QualityReport report={state.result.dataset.report} />
            <Button variant="contained" sx={{ mt: 3 }} onClick={() => onOpenDataset(state.result.dataset.id)}>
              Open in dashboard
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
