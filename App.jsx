import MyThree from './Three'
import SidePanel from './SidePanel'
import './App.css'
import { useState } from 'react';
import { SidePanelContext } from './SidePanelContext.mjs';

function App() {
  const [count, setCount] = useState(0)
  const [selection, setSelection] = useState(null)
  const [legend, setLegend] = useState(null)

  return (
    <SidePanelContext.Provider value={{ selection, setSelection, legend, setLegend }}>
    <div id="app">
      <SidePanel />
      <div id="my-three">
        <MyThree />
      </div>
    </div>
    </SidePanelContext.Provider>
  )
}

export default App
