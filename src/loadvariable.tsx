import React, { Component } from 'react';
import { Modal, ButtonToolbar, Button, Row, Col, Glyphicon, FormGroup, FormControl, ControlLabel, InputGroup } from 'react-bootstrap';
import _ from 'lodash';
import Dialog from 'react-bootstrap-dialog';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import { DropTarget, DragSource } from 'react-dnd';
import { findDOMNode } from 'react-dom';

import DimensionSlider from './DimensionSlider/DimensionSlider.jsx';
//import FileExplorer from '../FileExplorer/FileExplorer.jsx';
//import DragAndDropTypes from 'constants/DragAndDropTypes';

import './CachedFiles.scss';

function cleanPath(path) {
    return `/${path.split('/').filter(segment => segment).join('/')}`;
}

class CachedFiles extends Component {
    constructor(props) {
        super(props);
        this.state = {
            showFileExplorer: false,
            showRedefineVariableModal: false,
            selectedFile: '',
            historyFiles: [],
            variablesAxes: null,
            selectedVariable: null,
            selectedVariableName: '',
            redefinedVariableName: '',
            temporaryRedefinedVariableName: '',
            dimension: null
        }
    }

    get selectedFilePath() {
        return !this.state.selectedFile ? '' : cleanPath(this.state.selectedFile.path + '/' + this.state.selectedFile.name);
    }

    get variableName() {
        if (this.state.redefinedVariableName) {
            return this.state.redefinedVariableName;
        }
        return !this.state.selectedVariableName ? '' : this.state.selectedVariableName;
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.selectedVariableName !== prevState.selectedVariableName || (this.state.selectedVariableName && !this.state.selectedVariable)) {
            let selectedVariable, dimension;
            if (this.state.variablesAxes[0][this.state.selectedVariableName]) {
                // it's a variablevar 
                selectedVariable = this.state.variablesAxes[0][this.state.selectedVariableName];
                dimension = selectedVariable.axisList.map((axisName) => {
                    return { axisName };
                })
            }
            else {
                // it's a axis
                selectedVariable = this.state.variablesAxes[1][this.state.selectedVariableName];
                dimension = { axisName: this.state.selectedVariableName };
            }
            this.setState({
                selectedVariable,
                dimension
            });
        }
    }

    loadVariable() {
        let variable = this.state.selectedVariableName;
        let filename = this.state.selectedFile;
        let path = this.selectedFilePath;

        let var_obj = {};
        var_obj[this.variableName] = {
            cdms_var_name: variable,
            axisList: this.state.selectedVariable.axisList,
            filename: filename,
            path: path,
            dimension: this.state.dimension
        };
        this.props.loadVariables([var_obj]);
        this.setState({ redefinedVariableName: '' });
    }

    load() {
        return this.variableNameExists()
            .then((result) => {
                if (result) {
                    return new Promise((resolve, reject) => {
                        this.refs.dialog.show({
                            title: 'Variable exists',
                            body: `The variable name ${this.variableName} already exists, rename or overwrite existing varaible`,
                            actions: [
                                Dialog.OKAction(() => resolve())
                            ]
                        })
                    })
                        .then(() => this.redefineVariableName());
                }
            })
            .then(() => {
                return this.loadVariable()
            })
    }

    loadAndClose() {
        this.load().then(() => this.props.onTryClose());
    }

    loadAs() {
        this.redefineVariableName()
            .then(() => {
                this.loadVariable();
            })
    }

    variableNameExists() {
        return Promise.resolve(this.variableName in this.props.curVariables);
    }

    redefineVariableName() {
        return new Promise((resolve, reject) => {
            this.doneRedefineVariable = () => { resolve() };
            this.setState({
                showRedefineVariableModal: true,
                temporaryRedefinedVariableName: this.variableName
            });
        })
    }

    handleFileExplorerTryClose() {
        this.setState({ showFileExplorer: false });
    }

    handleFileSelected(file) {
        this.handleFileExplorerTryClose();
        var path = cleanPath(file.path + '/' + file.name);

        vcs.variables(path).then((variablesAxes) => {
            console.log(variablesAxes);
            var historyFiles = [file, ...this.state.historyFiles.filter(historyFile => {
                return historyFile.path !== file.path || historyFile.name !== file.name;
            })];
            this.setState({
                variablesAxes,
                selectedFile: file,
                historyFiles: historyFiles,
                selectedVariableName: Object.keys(variablesAxes[0])[0],
                selectedVariable: null
            });
        });
    }

    handleDimensionValueChange(values, axisName = undefined) {
        if (axisName) {
            this.state.dimension.find(dimension => dimension.axisName === axisName).values = values;
        }
        else {
            this.state.dimension.values = values;;
        }
    }

    render() {

        return (
            <Modal className='cached-files' bsSize="large" show={this.props.show} onHide={this.tryClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Load Variable</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="load-from">
                        <Row>
                            <Col className="text-right" sm={2}>
                                <h4>Load From</h4>
                            </Col>
                        </Row>
                        <Row>
                            <Col className="text-right" sm={2}>
                                File
                            </Col>
                            <Col sm={9}>
                                <InputGroup bsSize="small">
                                    <FormControl className="full-width file-path" type="text" value={this.selectedFilePath} />
                                    <InputGroup.Button>
                                        <Button bsStyle="primary" onClick={
                                            () => this.setState({ showFileExplorer: true })}><Glyphicon glyph="file" /></Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col className="text-right" sm={2}>
                                Variable(s)
                            </Col>
                            <Col sm={9}>
                                <FormControl
                                    className="input-sm full-width"
                                    componentClass="select"
                                    onChange={(e) => this.setState({ selectedVariableName: e.target.value })}
                                    value={this.state.selectedVariableName}>
                                    {this._formatvariablesAxes()}
                                </FormControl>
                            </Col>
                        </Row>
                        <Row>
                            <Col className="text-right" sm={2}>
                                History:
                            </Col>
                            <Col sm={9}>
                                <FormControl className="history" componentClass="div">
                                    {this.state.historyFiles.map((file, i) => {
                                        return <div className="file" key={i} onClick={(e) => this.handleFileSelected(file)}>{cleanPath(file.path + '/' + file.name)}</div>;
                                    })}
                                </FormControl>
                            </Col>
                        </Row>
                        {/* <Row>
                            <Col className="text-right" sm={2}>
                                Bookmarks(s):
                            </Col>
                            <Col sm={10}>
                                <FormControl componentClass="textarea" />
                            </Col>
                        </Row> */}
                    </div>
                    {this.state.selectedVariable &&
                        <div className="dimensions">
                            <Row>
                                <Col className="text-right" sm={2}>
                                    <h4>Dimensions</h4>
                                </Col>
                            </Row>
                            {/* If is a variable */}
                            {this.state.dimension &&
                                this.state.dimension.map(dimension => dimension.axisName).map((axisName, i) => {
                                    let axis = this.state.variablesAxes[1][axisName];
                                    return (
                                        <DimensionDnDContainer key={axisName} index={i} axis={axis} axisName={axisName} handleDimensionValueChange={(values) => this.handleDimensionValueChange(values, axisName)} moveDimension={(dragIndex, hoverIndex) => this.moveDimension(dragIndex, hoverIndex)} />
                                    )
                                })
                            }
                            {/* if is an Axis */}
                            {!this.state.selectedVariable.axisList &&
                                <Row key={this.state.selectedVariable.name} className="dimension">
                                    <Col sm={2} className="text-right"><span>{this.state.selectedVariable.name}</span></Col>
                                    <Col sm={8} className="right-content">
                                        <DimensionSlider {...this.state.selectedVariable} onChange={(values) => this.handleDimensionValueChange(values)} />
                                    </Col>
                                </Row>
                            }
                        </div>
                    }
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" bsSize="small" onClick={(e) => {
                        this.load()
                    }}>Load</Button>
                    <Button bsStyle="primary" bsSize="small" onClick={(e) => {
                        this.loadAndClose()
                    }}>Load and Close</Button>
                    <Button bsStyle="primary" bsSize="small" onClick={(e) => {
                        this.loadAs()
                    }}>Load As</Button>
                    <Button bsStyle="default" bsSize="small" onClick={() => this.props.onTryClose()}>Close</Button>
                </Modal.Footer>
                <Modal show={this.state.showRedefineVariableModal}>
                    <Modal.Header>
                        <Modal.Title id="contained-modal-title-sm">Rename variable</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <FormGroup>
                            <ControlLabel>Variable name</ControlLabel>
                            <FormControl
                                type="text"
                                value={this.state.temporaryRedefinedVariableName}
                                onChange={(e) => this.setState({ temporaryRedefinedVariableName: e.target.value })} />
                        </FormGroup>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button bsStyle="primary" bsSize="small"
                            onClick={() => {
                                if (this.state.temporaryRedefinedVariableName) {
                                    this.doneRedefineVariable();
                                    this.setState({
                                        redefinedVariableName: this.state.temporaryRedefinedVariableName,
                                        showRedefineVariableModal: false
                                    });
                                }
                            }}>Confirm</Button>
                        <Button bsSize="small" onClick={() => this.setState({ showRedefineVariableModal: false })}>Close</Button>
                    </Modal.Footer>
                </Modal>
                <Dialog ref="dialog" />
                {this.state.showFileExplorer &&
                    <FileExplorer show={true} onTryClose={() => this.handleFileExplorerTryClose()} onFileSelected={(file) => this.handleFileSelected(file)} />}
            </Modal>
        )
    }

    _formatvariablesAxes() {
        return this.state.variablesAxes && [
            <optgroup key="variables" label="------">{this._formatVariables(this.state.variablesAxes[0])}</optgroup>,
            <optgroup key="axes" label="------">{this._formatAxes(this.state.variablesAxes[1])}</optgroup>
        ]
    }

    _formatVariables(variables) {
        return Object.keys(variables).map((variableName) => {
            // let variable = variables[variableName];
            // let label = `${variableName} (${variable.shape.join(',')}) ${variable.name}`
            var vars = variables;
            var v = variableName;
            var shape = ' (' + vars[v].shape[0];
            for (let i = 1; i < vars[v].shape.length; ++i) {
                shape += (',' + vars[v].shape[i]);
            }
            shape += ')';
            // axes for the variable
            var al = vars[v].axisList;
            var axisList = '(' + al[0];
            for (let i = 1; i < al.length; ++i) {
                axisList += (', ' + al[i]);
            }
            axisList += ')';
            // bounds are received for longitude and latitude
            var boundsString = '';
            if (vars[v].bounds) {
                boundsString += ': (' + vars[v].bounds[0] + ', ' +
                    vars[v].bounds[1] + ')';
            }
            // longitude, latitude for the variable
            // these are different than the axes for the curvilinear or
            // generic grids
            var lonLat = null;
            if (vars[v].lonLat) {
                lonLat = '(' + vars[v].lonLat[0] + ', ' +
                    vars[v].lonLat[1] + ')';
            }
            var label = v + shape + ' [' + vars[v].name + ', ' +
                vars[v].units + boundsString + '] ' + ': ' + axisList;
            if (lonLat) {
                label += (', ' + lonLat);
            }
            if (vars[v].gridType) {
                label += (', ' + vars[v].gridType);
            }

            return <option key={v} value={v}>{label}</option>;
        })
    }

    _formatAxes(axes) {
        return Object.keys(axes).map((axisName) => {
            var v = axisName;
            var shape = '(' + axes[v].shape[0];
            for (let i = 1; i < axes[v].shape.length; ++i) {
                shape += (',' + axes[v].shape[i]);
            }
            shape += ')';
            var label = v + shape + '[' + axes[v].name + ', ' +
                axes[v].units + ': (' +
                axes[v].data[0] + ', ' +
                axes[v].data[axes[v].data.length - 1] + ')]';
            return <option key={axisName} value={axisName}>{label}</option>;
        });
    }

    moveDimension(dragIndex, hoverIndex) {
        var dimensions = this.state.dimension.slice();
        dimensions.splice(hoverIndex, 0, dimensions.splice(dragIndex, 1)[0]);
        this.setState({ dimension: dimensions });
    }
}
CachedFiles.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onTryClose: React.PropTypes.func.isRequired,
    cachedFiles: React.PropTypes.object,
    curVariables: React.PropTypes.object.isRequired,
    loadVariables: React.PropTypes.func,
    addFileToCache: React.PropTypes.func,
}

var DimensionContainer = (props) => {
    const opacity = props.isDragging ? 0 : 1;
    return props.connectDropTarget(props.connectDragPreview(<div className="row dimension" style={{ opacity }}>
        <Col sm={2} className="text-right"><span>{props.axis.name}</span></Col>
        {props.connectDragSource(<div className="sort col-sm-1"><Glyphicon glyph="menu-hamburger" /></div>)}
        <div className="col-sm-7 right-content">
            <DimensionSlider {...props.axis} onChange={props.handleDimensionValueChange} />
        </div>
    </div>));
}

var DimensionDnDContainer = _.flow(
    DragSource(DragAndDropTypes.DIMENSION,
        {
            beginDrag: (props) => {
                return {
                    id: props.id,
                    index: props.index
                }
            }
        },
        (connect, monitor) => {
            return {
                connectDragSource: connect.dragSource(),
                connectDragPreview: connect.dragPreview(),
                isDragging: monitor.isDragging()
            };
        }
    ),
    DropTarget(
        DragAndDropTypes.DIMENSION,
        {
            // by example of react-dnd https://github.com/react-dnd/react-dnd/blob/master/examples/04%20Sortable/Simple/Card.js#L25
            hover(props, monitor, component) {
                const dragIndex = monitor.getItem().index;
                const hoverIndex = props.index;
                if (dragIndex === hoverIndex) {
                    return;
                }
                const hoverBoundingRect = findDOMNode(component).getBoundingClientRect();
                const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
                const clientOffset = monitor.getClientOffset();
                const hoverClientY = clientOffset.y - hoverBoundingRect.top;
                if ((dragIndex < hoverIndex && hoverClientY < hoverMiddleY)
                    || (dragIndex > hoverIndex && hoverClientY > hoverMiddleY)) {
                    return;
                }
                props.moveDimension(dragIndex, hoverIndex);
                // Note: we're mutating the monitor item here!
                // Generally it's better to avoid mutations,
                // but it's good here for the sake of performance
                // to avoid expensive index searches.
                monitor.getItem().index = hoverIndex;
            },
        },
        (connect, monitor) => {
            return {
                connectDropTarget: connect.dropTarget(),
                isOver: monitor.isOver(),
            };
        }
    ))
    (DimensionContainer);


export default CachedFiles;

