import MyThree from '../features/map/Three'
import SidePanel from '../features/panels/SidePanel'
import PathFindingPanel from '../features/pathfinding/PathFindingPanel'
import LoginDialog from '../features/auth/LoginDialog'
import './App.css'
import { DataProvider } from '../data/DataContext.ts';
import { PathFindingProvider } from '../features/pathfinding/PathFindingProvider'

function App() {
  return (
    <DataProvider>
      <LoginDialog />
      <PathFindingProvider>
        <div id="app">
          <SidePanel />
          <PathFindingPanel />
          <div id="my-three">
            <MyThree />
          </div>
        </div>
      </PathFindingProvider>
    </DataProvider>
  )
}

export default App
