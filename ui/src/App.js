import './App.css';
import axios from "axios";
import { useEffect, useState } from "react";

function App() {
  const [workflowStatus, setWorkflowStatus] = useState('');
  const [workflowOperation, setWorkflowOperation] = useState('');
  const [orphansDetected, setOrphansDetected] = useState(0)
  const [showApproveButton, setShowApproveButton] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      axios.get('http://localhost:3001/api/workflow/status')
          .then(response => {
            setWorkflowStatus(response.data.status);
            setWorkflowOperation(response.data.operation);
            setOrphansDetected(response.data.orphansDetected);
            setShowApproveButton(response.data.operation === 'awaiting_cleanup_approval');
          });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const startWorkflow = () => {
    axios.post('http://localhost:3001/api/workflow/start');
  };

  const cancelWorkflow = () => {
    axios.post('http://localhost:3001/api/workflow/cancel');
  };

  const approveWorkflow = () => {
    axios.post('http://localhost:3001/api/workflow/signal', { signal: 'approve' });
  };

  return (
    <div className="App">
        <div className="App-header">
            <h1>Temporal UI</h1>
            <button onClick={startWorkflow}>Start Workflow</button>
            <button onClick={cancelWorkflow}>Cancel Workflow</button>
            {showApproveButton && <button onClick={approveWorkflow}>Approve</button>}
            <SyncStatus wfStatus={workflowStatus} />
            <p>Workflow Current Operation: {workflowOperation}</p>
            {orphansDetected > 0 && <p>Orphans Detected: {orphansDetected}</p>}
        </div>
    </div>
  );
}

export default App;

const SyncStatus = ({ wfStatus }) => {
    let status = 'Checking status'
    let durationStr = ''
    switch (wfStatus?.status?.name?.toLowerCase() ?? '') {
        case 'completed':
            if (wfStatus?.closeTime !== undefined && wfStatus?.executionTime !== undefined) {
                durationStr = secondsToHumanReadable(
                    (new Date(wfStatus.closeTime).getTime() - new Date(wfStatus.executionTime).getTime()) / 1000,
            )
            }
            if (durationStr.length > 0) {
                durationStr = `took ${durationStr}, `
            }
            const finishedAt = new Date(wfStatus?.closeTime).toISOString()
            status = `Completed, ${durationStr}finished at ${finishedAt}`
            break
        case 'running':
            if (wfStatus?.executionTime !== undefined) {
                durationStr = secondsToHumanReadable(
                    (new Date().getTime() - new Date(wfStatus.executionTime).getTime()) / 1000,
            )
            }
            if (durationStr.length > 0) {
                durationStr += ' ago'
            }
            status = `Running, started ${durationStr}`
            break
        case 'failed':
            const reason = wfStatus?.reason ?? ''
            status = `Failed: ${reason.length > 0 ? reason : 'No reason provided'}`
            break
        case 'terminated':
            status = 'Terminated'
            break
        case 'cancelled':
            status = 'Cancelled'
            break
        default:
            status = 'No information available'
    }

    return <>{status}</>
}

function secondsToHumanReadable(sec_num) {
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = Math.round((sec_num - (hours * 3600) - (minutes * 60)) * 1000) / 1000;

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}