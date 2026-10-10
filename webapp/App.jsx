import MyThree from './Three'
import SidePanel from './SidePanel'
import PathFindingPanel from './PathFindingPanel'
import LoginDialog from './LoginDialog'
import './App.css'
import { DataProvider } from './DataContext.mjs';
import { PathFindingProvider } from './PathFindingProvider'

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
