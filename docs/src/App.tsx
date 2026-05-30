import { useState, useEffect } from 'react';
import { Box, Plug, RefreshCcw, AlertCircle, Award, Gavel, CheckCircle2 } from 'lucide-react';
import { BrowserProvider, Contract, Interface, id as idFormat } from 'ethers';
import BoxABI from './contracts/BoxABI.json';
import GovTokenABI from './contracts/GovTokenABI.json';
import MyGovernorABI from './contracts/MyGovernorABI.json';
import './App.css';

// Hardcoded Addresses from Sepolia Deployment
const BOX_ADDRESS = "0xCB23c96ADea70867C226eb5751D14f4D60bd402B";
const GOV_TOKEN_ADDRESS = "0x4648b142dC5b31AF8FB283416cEfe4e0A1EAEA28";
const GOVERNOR_ADDRESS = "0x62AEc408fa7C82e779290ED987C16Fee57828dD3";

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [number, setNumber] = useState<string>('--');
  const [newNumber, setNewNumber] = useState<string>(() => localStorage.getItem('dao_newNumber') || '');
  const [proposalId, setProposalId] = useState<string>(() => localStorage.getItem('dao_proposalId') || '');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [proposalState, setProposalState] = useState<string>('');
  const [proposalDeadline, setProposalDeadline] = useState<string>('');
  const [isDelegated, setIsDelegated] = useState<boolean>(false);

  const STATES = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];

  // Persist proposal data to localStorage
  const updateNewNumber = (val: string) => { setNewNumber(val); localStorage.setItem('dao_newNumber', val); };
  const updateProposalId = (val: string) => { setProposalId(val); localStorage.setItem('dao_proposalId', val); };

  const checkDelegateStatus = async (addr: string) => {
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const token = new Contract(GOV_TOKEN_ADDRESS, GovTokenABI, provider);
      const delegates = await token.delegates(addr);
      // Self-delegated if delegates points to own address
      setIsDelegated(delegates.toLowerCase() === addr.toLowerCase());
    } catch (err) {
      console.error(err);
    }
  };

  const checkProposalStatus = async () => {
    if (!proposalId) return;
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const governor = new Contract(GOVERNOR_ADDRESS, MyGovernorABI, provider);
      const state = await governor.state(proposalId);
      const stateName = STATES[Number(state)];
      setProposalState(stateName);

      // Get deadline block info if Active
      if (stateName === 'Active' || stateName === 'Pending') {
        try {
          const deadline = await governor.proposalDeadline(proposalId);
          const currentBlock = await provider.getBlockNumber();
          const blocksLeft = Number(deadline) - currentBlock;
          if (blocksLeft > 0) {
            // Sepolia ~12 sec/block
            const secsLeft = blocksLeft * 12;
            const hours = Math.floor(secsLeft / 3600);
            const mins = Math.floor((secsLeft % 3600) / 60);
            setProposalDeadline(`~${blocksLeft} blocks left (≈${hours}h ${mins}m)`);
          } else {
            setProposalDeadline('Voting ended, refreshing...');
          }
        } catch {
          setProposalDeadline('');
        }
      } else {
        setProposalDeadline('');
      }
    } catch (err) {
      console.error(err);
      setProposalState('Unknown');
    }
  };

  useEffect(() => {
    if (proposalId) {
      const timer = setInterval(checkProposalStatus, 10000);
      checkProposalStatus();
      return () => clearInterval(timer);
    }
  }, [proposalId]);

  // Initialize connection check on mount
  useEffect(() => {
    checkConnection();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        const addr = accounts.length > 0 ? accounts[0] : null;
        setAccount(addr);
        if (addr) checkDelegateStatus(addr);
      });
      window.ethereum.on('chainChanged', (hexChainId: string) => {
        setChainId(BigInt(hexChainId));
      });
    }
  }, []);

  useEffect(() => {
    if (account && chainId === BigInt(11155111)) {
      readNumber();
      checkDelegateStatus(account);
      setError('');
    } else if (chainId && chainId !== BigInt(11155111)) {
      setError('Please switch your MetaMask network to Sepolia!');
    }
  }, [account, chainId]);

  const clearError = () => setError('');

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
        }
        const network = await provider.getNetwork();
        setChainId(network.chainId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const connectWallet = async () => {
    clearError();
    if (!window.ethereum) { setError('MetaMask is not installed!'); return; }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts.length > 0) setAccount(accounts[0]);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  const delegate = async () => {
    clearError();
    if (!account) return;
    if (isDelegated) {
      alert('Voting power already unlocked for this wallet!');
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(GOV_TOKEN_ADDRESS, GovTokenABI, signer);
      const tx = await contract.delegate(account);
      await tx.wait();
      setIsDelegated(true);
      alert('Success: Voting power unlocked!');
    } catch (err: any) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const readNumber = async () => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const contract = new Contract(BOX_ADDRESS, BoxABI, provider);
      const val = await contract.getNumber();
      setNumber(val.toString());
    } catch (err: any) {
      setNumber('--');
    }
    setLoading(false);
  };

  // --- DAO GOVERNANCE FUNCTIONS ---

  const propose = async () => {
    clearError();
    if (!newNumber) { setError('Enter a value first'); return; }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const governor = new Contract(GOVERNOR_ADDRESS, MyGovernorABI, signer);
      
      const boxInterface = new Interface(BoxABI);
      const calldata = boxInterface.encodeFunctionData("store", [newNumber]);
      
      const description = `Changing Box value to ${newNumber}`;
      const tx = await governor.propose([BOX_ADDRESS], [0], [calldata], description);
      const receipt = await tx.wait();
      
      // Find ProposalCreated event
      const event = receipt.logs.find((x: any) => x.eventName === 'ProposalCreated' || x.fragment?.name === 'ProposalCreated');
      if (event) {
        const id = event.args[0].toString();
        updateProposalId(id);
        alert(`Proposal Created! ID: ${id}\n\nVoting period: ~50400 blocks (~7 days on Sepolia)\nCheck back once state changes to "Succeeded".`);
      } else {
        alert('Proposal initiated. Check your transaction history for the ID.');
      }
    } catch (err: any) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const castVote = async (support: number) => {
    clearError();
    if (!proposalId) { setError('No active Proposal ID'); return; }
    if (proposalState && proposalState !== 'Active') {
      setError(`Cannot vote: proposal is "${proposalState}", must be "Active"`);
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const governor = new Contract(GOVERNOR_ADDRESS, MyGovernorABI, signer);
      
      const tx = await governor.castVote(proposalId, support);
      await tx.wait();
      alert('Vote cast successfully!');
      await checkProposalStatus();
    } catch (err: any) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const queueAndExecute = async () => {
    clearError();
    if (!proposalId || !newNumber) { setError('Need Proposal ID and intended value'); return; }
    if (proposalState !== 'Succeeded' && proposalState !== 'Queued') {
      setError(`Cannot queue/execute: proposal is "${proposalState}". Wait until it is "Succeeded".`);
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const governor = new Contract(GOVERNOR_ADDRESS, MyGovernorABI, signer);
      
      const boxInterface = new Interface(BoxABI);
      const calldata = boxInterface.encodeFunctionData("store", [newNumber]);
      const descriptionHash = idFormat(`Changing Box value to ${newNumber}`);

      if (proposalState === 'Succeeded') {
        // Queue
        try {
          const qTx = await governor.queue([BOX_ADDRESS], [0], [calldata], descriptionHash);
          await qTx.wait();
          alert('Queued in Timelock! Waiting for timelock delay...');
          await checkProposalStatus();
        } catch (e: any) {
          console.warn("Queue might have been already done or skipped", e);
        }
      }

      // Execute
      const eTx = await governor.execute([BOX_ADDRESS], [0], [calldata], descriptionHash);
      await eTx.wait();
      alert('Executed! Number updated.');
      await readNumber();
      await checkProposalStatus();
    } catch (err: any) {
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const canQueueExecute = proposalState === 'Succeeded' || proposalState === 'Queued';

  return (
    <div className="container">
      <header className="app-header">
        <div className="logo-section">
          <Box size={32} color="#00f2fe" />
          <h2 style={{margin:0}}>DAO Box Interface</h2>
        </div>
        <div className="action-row">
          {account && (
            <button
              onClick={delegate}
              disabled={loading || isDelegated}
              className={isDelegated ? 'btn-secondary delegated' : 'btn-secondary'}
              title={isDelegated ? 'Already delegated' : 'Unlock voting power'}
            >
              <Award size={18} />
              {isDelegated ? '✓ Voting Power Active' : 'Unlock Voting Power'}
            </button>
          )}
          <button onClick={connectWallet} className={account ? 'connected' : ''}>
            <Plug size={18} /> {account ? `${account.substring(0,6)}...` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {error && <div className="error-message"><AlertCircle size={20} /> <span>{error}</span></div>}

      <div className="dashboard-grid">
        {/* CONTRACT STATE */}
        <div className="card">
          <h3>Contract State</h3>
          <div className="number-display">{number}</div>
          <button onClick={readNumber} disabled={loading} className="btn-ghost">
            <RefreshCcw size={16} className={loading ? 'spinning' : ''} /> Refresh Value
          </button>
          <div style={{marginTop:'1.5em', fontSize:'0.75em', opacity: 0.5}}>Box: {BOX_ADDRESS}</div>
        </div>

        {/* DAO ACTIONS */}
        <div className="card active">
          <h3>DAO Governance Flow</h3>
          
          <div className="step-box">
            <label>1. Propose Change</label>
            <div className="input-group">
              <input type="number" placeholder="New value" value={newNumber} onChange={(e)=>updateNewNumber(e.target.value)} />
              <button onClick={propose} disabled={loading}><Gavel size={16}/> Propose</button>
            </div>
            <div style={{fontSize:'0.75em', opacity:0.6, marginTop:'6px'}}>
              ⚠️ Voting period: ~50400 blocks (~7 days on Sepolia)
            </div>
          </div>

          <div className="step-box">
            <label>
              2. Cast Your Vote {proposalState && (
                <span className={`status-text ${proposalState.toLowerCase()}`}>({proposalState})</span>
              )}
            </label>
            {proposalDeadline && (
              <div style={{fontSize:'0.75em', opacity:0.65, marginBottom:'6px', color:'#facc15'}}>
                ⏳ {proposalDeadline}
              </div>
            )}
            <div className="input-group">
              <input
                type="text"
                placeholder="Proposal ID"
                value={proposalId}
                onChange={(e)=>updateProposalId(e.target.value)}
              />
              <button onClick={checkProposalStatus} disabled={loading} className="btn-ghost" title="Refresh status">
                <RefreshCcw size={14}/>
              </button>
            </div>
            <div className="vote-buttons" style={{display:'flex', gap: '10px', marginTop: '10px'}}>
              <button
                onClick={()=>castVote(1)}
                className="btn-vote-for"
                disabled={loading || proposalState !== 'Active'}
              >FOR</button>
              <button
                onClick={()=>castVote(0)}
                className="btn-vote-against"
                disabled={loading || proposalState !== 'Active'}
              >AGAINST</button>
            </div>
            {proposalState === 'Active' && (
              <div style={{fontSize:'0.75em', opacity:0.6, marginTop:'6px'}}>
                Voting in progress — each wallet can only vote once.
              </div>
            )}
          </div>

          <div className="step-box">
            <label>3. Finalize</label>
            {!canQueueExecute && proposalState && (
              <div style={{fontSize:'0.75em', color:'#fb923c', marginBottom:'8px'}}>
                Waiting for state "Succeeded" (current: {proposalState})
              </div>
            )}
            <button
              onClick={queueAndExecute}
              className="btn-primary"
              disabled={loading || !canQueueExecute}
              style={{width:'100%', opacity: canQueueExecute ? 1 : 0.45}}
            >
              <CheckCircle2 size={18}/> Queue & Execute
            </button>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>Deployment: Sepolia Testnet | Governor: {GOVERNOR_ADDRESS.substring(0,10)}...</p>
      </footer>
    </div>
  );
}

export default App;
