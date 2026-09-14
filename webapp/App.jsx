import MyThree from './Three'
import SidePanel from './SidePanel'
import PathFindingPanel from './PathFindingPanel'
import './App.css'
import { DataProvider } from './DataContext.mjs';
import { PathFindingProvider } from './PathFindingProvider'

function App() {
  return (
    <DataProvider>
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
