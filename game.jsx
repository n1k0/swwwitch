/** @jsx React.DOM */
/**
 * TODO
 * - RWD
 */
var MAX_LEVEL = 9;
var ADD_CELL_INTERVAL_SECONDS = 6;
var WAIT_CELL_TIMEOUT_SECONDS = 5;
var TAP_CELL_TIMEOUT_SECONDS = 3;
var CELL_WAIT = "wait";
var CELL_TAP = "tap";
var CELL_DONE = "done";
var CELL_DEAD = "dead";

function toggleFullScreen() {
  // http://www.html5rocks.com/en/mobile/fullscreen/
  // yeah, I'm crying blood too.
  var doc = window.document;
  var docEl = doc.documentElement;
  var requestFullScreen = docEl.requestFullscreen ||
                          docEl.mozRequestFullScreen ||
                          docEl.webkitRequestFullScreen ||
                          docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen ||
                         doc.mozCancelFullScreen ||
                         doc.webkitExitFullscreen ||
                         doc.msExitFullscreen;
  if(!doc.fullscreenElement &&
     !doc.mozFullScreenElement &&
     !doc.webkitFullscreenElement &&
     !doc.msFullscreenElement) {
    requestFullScreen.call(docEl);
  } else {
    cancelFullScreen.call(doc);
  }
}

function getAvailableWindowSize() {
  var availHeight = window.innerHeight - 200; // ~ title height… FIXME.
  return window.innerWidth > availHeight ?
         availHeight : window.innerWidth;
}

function range(n) {
  return Array.apply(0, Array(n)).map(function (_, i) {
    return i;
  });
}

function slice(list) {
  return [].slice.apply(list, [].slice.call(arguments, 1));
}

function replaceAt(list, index, value) {
  // hint: splice sucks balls.
  var start = slice(list, 0, index);
  var end = slice(list, index + 1, list.length);
  return start.concat(value, end);
}

var gameData = (function() {
  var _cells = [], _changeListeners = [];

  function _findOffIndexes() {
    return _cells.reduce(function(indexes, cell, i) {
      return cell.type === "off" ? indexes.concat(i) : indexes;
    }, []);
  }

  function _setCells(cells) {
    _cells = cells;
    _changeListeners.forEach(function(listener) {
      listener();
    });
  }

  return {
    getCells: function() {
      return _cells;
    },
    addChangeListener: function(listener) {
      _changeListeners.push(listener);
    },
    removeChangeListener: function(listener) {
      _changeListeners = _changeListeners.filter(function(aListener) {
        return aListener !== listener;
      });
    },
    initCells: function(numberOfCells) {
      _setCells(range(numberOfCells).map(function() {
        return {type: "off"};
      }));
    },
    activateNewCell: function() {
      var offIndexes = _findOffIndexes();
      if (offIndexes.length === 0) return false;
      var randomIndex = Math.floor(Math.random() * offIndexes.length);
      var swapIndex = offIndexes[randomIndex];
      _setCells(replaceAt(_cells, swapIndex, {type: CELL_WAIT}));
      return true;
    },
    switchCellTo: function(cell, type) {
      _setCells(_cells.map(function(aCell) {
        return aCell === cell ? {type: type} : aCell;
      }));
    },
    freezeCells: function() {
      _setCells(_cells.map(function(aCell) {
        if (aCell.type === CELL_TAP || aCell.type === CELL_WAIT)
          return {type: CELL_DONE};
        return aCell;
      }));
    },
    checkGridComplete: function() {
      return _findOffIndexes().length === 0;
    }
  };
})();

var TimerMixin = {
  getDefaultProps: function() {
    return {countdown: 3};
  },
  getInitialState: function() {
    return {countdown: parseInt(this.props.countdown, 10)};
  },
  componentDidMount: function() {
    this._timer = setInterval(this.onSecondElapsed, 1000);
  },
  componentWillUnmount: function() {
    this.cancelTimer();
  },
  cancelTimer: function() {
    if (this._timer) clearInterval(this._timer);
  },
  onSecondElapsed: function() {
    if (this.state.countdown > 1) {
      return this.setState({countdown: this.state.countdown - 1});
    }
    this.cancelTimer();
    this.props.onTimeout(this.props.cell);
  }
};

var Cell = React.createClass({
  getDefaultProps: function() {
    return {size: 48};
  },
  handleClick: function(event) {
    event.preventDefault();
    if (this.props.onClick) {
      this.props.onClick(this.props.cell);
    }
  },
  _getStyle: function() {
    return {
      width: this.props.size,
      height: this.props.size,
      fontSize: Math.round(this.props.size / 4) + "px",
      lineHeight: Math.round(this.props.size / 2.2) + "px",
    };
  },
  render: function() {
    var classes = {cell: true};
    classes[this.props.cell.type || "off"] = true;
    return (
      <div className={React.addons.classSet(classes)}
           onClick={this.handleClick}
           style={this._getStyle()}>
        <div className="inner">
          {this.props.label ? <p>{this.props.label}</p> : null}
          {this.props.countdown ? <p>{this.props.countdown}</p> : null}
        </div>
      </div>
    );
  }
});

var WaitCell = React.createClass({
  mixins: [TimerMixin],
  render: function() {
    return <Cell
      cell={this.props.cell}
      size={this.props.size}
      label="WAIT"
      countdown={this.state.countdown}
    />;
  }
});

var TapCell = React.createClass({
  mixins: [TimerMixin],
  render: function() {
    return <Cell
      cell={this.props.cell}
      size={this.props.size}
      label="TAP"
      onClick={this.props.onTapped}
      countdown={this.state.countdown}
    />;
  }
});

var Overlay = React.createClass({
  clickFullscren: function(event) {
    event.preventDefault();
    toggleFullScreen();
  },
  render: function() {
    return (
      <div className="overlay">
        <h1>{this.props.title}</h1>
        {this.props.children}
        <StartButton label={this.props.buttonLabel}
                     onClick={this.props.onButtonClick} />
        <p>
          <a href="#" onClick={this.clickFullscren}>Toogle fullscreen</a>
        </p>
      </div>
    );
  }
});

var StartButton = React.createClass({
  getDefaultProps: function() {
    return {label: "Start new game"};
  },
  render: function() {
    return (
      <p>
        <button onClick={this.props.onClick}>{this.props.label}</button>
      </p>
    );
  }
});

var Grid = React.createClass({
  getDefaultProps: function() {
    return {level: 1};
  },
  getInitialState: function() {
    return {level: this.props.level, cells: []};
  },
  componentDidMount: function() {
    gameData.addChangeListener(this.onStoreChanged);
    gameData.initCells(this._getNumberOfCells());
  },
  componentWillUnmount: function() {
    gameData.removeChangeListener(this.onStoreChanged);
    clearInterval(this._addCellTimer);
  },
  onStoreChanged: function() {
    this.setState({cells: gameData.getCells()});
  },
  componentWillReceiveProps: function(nextProps) {
    if (this.props.gameState !== "ongoing" && nextProps.gameState === "ongoing") {
      this.setState({level: nextProps.level}, this.initiateGrid);
    }
  },
  _getNumberOfCells: function() {
    var size = this.props.level + 1;
    return size * size;
  },
  initiateGrid: function() {
    gameData.initCells(this._getNumberOfCells());
    this._addCellTimer = setInterval(this.activateNewCell, ADD_CELL_INTERVAL_SECONDS * 1000);
    this.activateNewCell();
  },
  activateNewCell: function() {
    if (!gameData.activateNewCell())
      return this.nextLevel();
  },
  onCellTapped: function(cell) {
    this.props.incrementScore();
    if (gameData.checkGridComplete())
      return this.nextLevel();
    gameData.switchCellTo(cell, CELL_WAIT);
  },
  onCellTimeout: function(cell) {
    if (cell.type === CELL_TAP) {
      gameData.switchCellTo(cell, CELL_DEAD);
      this.gameOver(cell);
    } else {
      gameData.switchCellTo(cell, CELL_TAP);
    }
  },
  gameOver: function(failedCell) {
    clearInterval(this._addCellTimer);
    gameData.freezeCells();
    this.props.gameOver();
  },
  nextLevel: function() {
    clearInterval(this._addCellTimer);
    gameData.freezeCells();
    this.props.nextLevel();
  },
  _getCellComponent: function(cell, key) {
    var cellSize = Math.floor(getAvailableWindowSize() / Math.sqrt(this._getNumberOfCells()));
    switch(cell.type) {
      case CELL_WAIT: {
        return <WaitCell
          key={key}
          cell={cell}
          size={cellSize}
          countdown={WAIT_CELL_TIMEOUT_SECONDS}
          onTimeout={this.onCellTimeout}
        />;
      }
      case CELL_TAP: {
        return <TapCell
          key={key}
          cell={cell}
          size={cellSize}
          countdown={TAP_CELL_TIMEOUT_SECONDS}
          onTimeout={this.onCellTimeout}
          onTapped={this.onCellTapped}
        />;
      }
      default: {
        return <Cell key={key} cell={cell} size={cellSize} />;
      }
    }
  },
  _getStyle: function() {
    return {
      width: getAvailableWindowSize(),
      margin: "0 auto"
    };
  },
  render: function() {
    return (
      <div className="grid" style={this._getStyle()}>{
        this.state.cells.map(function(cell, i) {
          return this._getCellComponent(cell, i);
        }, this)
      }</div>
    );
  }
});

var Game = React.createClass({
  getDefaultProps: function() {
    return {level: 1};
  },
  getInitialState: function() {
    return {
      gameState: "init",
      level: this.props.level,
      score: 0,
      best: localStorage["swwwitch.best"] || 0
    };
  },
  startGame: function() {
    this.setState({
      gameState: "ongoing",
      level: 1,
      score: 0
    });
  },
  startNextLevel: function() {
    var nextLevel = this.state.level + 1;
    if (nextLevel > MAX_LEVEL) {
      return this.winGame();
    }
    this.setState({
      gameState: "ongoing",
      level: nextLevel
    });
  },
  nextLevel: function() {
    this.setState({gameState: "levelup"});
  },
  incrementScore: function() {
    var newScore = this.state.score + 1;
    this.setState({score: newScore, best: this._computeBest(newScore)});
  },
  winGame: function() {
    this.setState({gameState: "win"});
  },
  gameOver: function() {
    this.setState({gameState: "over"});
  },
  _computeBest: function(score) {
    var best = this.state.best;
    if (score > best) {
      localStorage["swwwitch.best"] = score;
      return score;
    }
    return best;
  },
  _renderOverlay: function() {
    switch (this.state.gameState) {
      case "init": {
        return (
          <Overlay title="How to play?" onButtonClick={this.startGame}>
            <p>Tap a tile when it turns green.</p>
            <p>You win when no more tile is available.</p>
            <p>Don’t miss any or the game ends!</p>
          </Overlay>
        );
      }
      case "levelup": {
        return (
          <Overlay title={"Level " + this.state.level + " completed!"}
                   buttonLabel="Start next level"
                   onButtonClick={this.startNextLevel}>
            <p>Get ready!</p>
          </Overlay>
        );
      }
      case "over":
      case "win": {
        return <Overlay
          title={this.state.gameState === "win" ? "You won!" : "Game Over."}
          onButtonClick={this.startGame}>
          <p>You scored {this.state.score} point(s).</p>
        </Overlay>;
      }
      default: return;
    }
  },
  render: function() {
    return (
      <div className="game">
        <h1>Swwwitch</h1>
        <h2>Level: {this.state.level} — Score: {this.state.score} — Best: {this.state.best}</h2>
        <Grid level={this.state.level}
              incrementScore={this.incrementScore}
              gameState={this.state.gameState}
              nextLevel={this.nextLevel}
              gameOver={this.gameOver} />
        {this._renderOverlay()}
      </div>
    );
  }
});

React.renderComponent(<Game />, document.querySelector("#game"));
