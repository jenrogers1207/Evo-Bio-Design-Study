import '../styles/index.scss';
import * as d3 from "d3";
import {loadData} from './dataLoad';
import {calculateNewScales, rootAttribute, combineLength} from './dataFormat';
import {allPaths, pullPath, getPathRevised, getPath} from './pathCalc';
import {renderTree, buildTreeStructure, renderTreeButtons} from './sidebarComponent';
import {toolbarControl} from './toolbarComponent';
import { initialViewLoad } from './viewControl';
import { groupDataByClade, groupDataByAttribute, addCladeGroup, cladesGroupKeeper, chosenCladesGroup} from './cladeMaker';
import { binGroups } from './distributionView';

export const dataMaster = [];
export const savedSelected = [];
export const collapsed = false;
export const nestedData = [];
export const speciesTest = [];
export const calculatedScalesKeeper = [];

export const colorKeeper = [
    ['#0dc1d1', '#c8f7fd'],
    ['#3AD701', '#2a9b01'],
    ['#fec303', '#d3a001'],
    ['#fe4ecb', '#d30197'],
    ['#f36b2c'],
    ['#1abc9c'],
    ['#493267'],
    ['#a40b0b'],
    ['#0095b6'],
    ['#97A628'],
    ['#9B28A6'],
    ['#3928A6'],
    ['#0dc1d1', '#c8f7fd'],
    ['#3AD701', '#2a9b01'],
    ['#fec303', '#d3a001'],
    ['#fe4ecb', '#d30197'],
    ['#f36b2c'],
    ['#1abc9c'],
    ['#493267'],
    ['#a40b0b'],
    ['#0095b6'],
    ['#97A628'],
    ['#9B28A6'],
    ['#3928A6'],
]

export const attributeList = [];

let discreteTraitList = ['Clade', 'Group', 'island/mainland']

let wrap = d3.select('#wrapper');
let main = wrap.select('#main');
wrap.select('#selected').classed('hidden', true);
let sidebar = wrap.select('#sidebar');
let toolbarDiv = wrap.select('#toolbar');
wrap.select('#filter-tab').classed('hidden', true);

let tooltip = wrap.append("div")
.attr("id", "tooltip")
.style("opacity", 0);

////DATA LOADING////

appLaunch();

async function appLaunch(){

//     dataLoadAndFormat('geospiza-edges.json', 'geospiza-edge-lengths.json', 'geospiza-leaf-data.csv', 'geospiza-res.json', 'Geospiza').then((centData)=> {
      
//         toolbarControl(toolbarDiv, main, centData[1]);
//         wrap.select('#filter-tab').classed('hidden', true);
//         renderTreeButtons(centData[0], sidebar, false);
//         renderTree(sidebar, null, true, false);
//         /// LOWER ATTRIBUTE VISUALIZATION ///
//         initialViewLoad(centData[1], 'Geospiza');
//     });

    // dataLoadAndFormat('centrarchid-edges.json', 'centrarchid-edge-lengths.json', 'centrarchid-leaf-data.csv', 'centrarchid-res.json', 'Centrarchid').then((centData)=> {
      
    //         toolbarControl(toolbarDiv, main, centData[1]);
    //         wrap.select('#filter-tab').classed('hidden', true);
    //         renderTreeButtons(centData[0], sidebar, false);
    //         renderTree(sidebar, null, true, false);
    //         /// LOWER ATTRIBUTE VISUALIZATION ///
    //         initialViewLoad(centData[1], 'Centrarchid');
    // });

    dataLoadAndFormat('anolis-edges.json', 'anolis-edge-lengths.json', 'anolis-leaf-data.csv', 'anolis-res.json', 'Anolis').then((centData)=> {
      
        toolbarControl(toolbarDiv, main, centData[1]);
        
        renderTreeButtons(centData[0], sidebar, false);
        renderTree(sidebar, null, true, false);
        /// LOWER ATTRIBUTE VISUALIZATION ///
        initialViewLoad(centData[1], 'Anolis');
});

}

async function dataLoadAndFormat(edgeFile, edgeLengthFile, leafCharFile, resFile, dataName){

        //helper function to create array of unique elements
        Array.prototype.unique = function() {
            return this.filter(function (value, index, self) { 
                return self.indexOf(value) === index;
            });
        }

        let edges = await loadData(d3.json, `./public/data/${edgeFile}`, 'edge');
        let leafChar = await loadData(d3.csv, `./public/data/${leafCharFile}`, '');
        let edgeLen = await loadData(d3.json, `./public/data/${edgeLengthFile}`, 'edge');
        let char = await loadData(d3.json, `./public/data/${resFile}`, '');
    
        ///Creating attribute list to add estimated values in //
    
        leafChar.columns.filter(f=> f != 'species').forEach((d, i)=> {
    
            if(discreteTraitList.indexOf(d) > -1){
                attributeList.push({field: d, type: 'discrete'});
            }else{
                attributeList.push({field: d, type:'continuous'});
            }
    
        });
    
        edges.rows = edges.rows.filter(f=> f.From != "").map((edge, i)=> {
            edge.edgeLength = edgeLen.rows[i].x;
            return edge;
        });  
    
        //Mapping data together/////
        let edgeSource = edges.rows.map(d=> d.From);
       
        let leaves = edges.rows.filter(f=> edgeSource.indexOf(f.To) == -1 );
    
        let calculatedAtt = char.rows.map((row, i)=> {
            let newRow = {};
            attributeList.forEach((att)=>{
                newRow[att.field] = {};
                newRow[att.field].field = att.field;
                newRow[att.field].type = att.type;
                let values = {}
                d3.entries(row).filter(f=> f.key.includes(att.field)).map(m=> {
                    if(att.type === 'continuous'){
                       
                        if(m.key.includes('upperCI')){
                            values.upperCI95 = m.value;
                        }else if(m.key.includes('lowerCI')){
                            values.lowerCI95 = m.value;
                        }else{
                            values.realVal = m.value;
                        }
                    }else{
                         values[m.key] = m.value;   
                    }
                });
                newRow[att.field].values = values;
            });
            newRow.node = row.nodeLabels;
            return newRow;
        });
    
      
        let calculatedScales = calculateNewScales(calculatedAtt, attributeList.map(m=> m.field), colorKeeper);
    
        let matchedEdges = edges.rows.map((edge, i)=> {
            let attrib = calculatedAtt.filter(f=> f.node === edge.To)[0]
            if(attrib){
                Object.keys(attrib).filter(f=> f != 'node').map((att, i)=>{
                    
                    let scales = calculatedScales.filter(f=> f.field=== att)[0]
                    attrib[att].scales = scales;
                    return att;
                    
                })
            }
            let newEdge = {
                V1: edge.From,
                V2: edge.To,
                node: edge.To,
                edgeLength: edge.edgeLength,
                attributes: attrib ? attrib : null
            }
            return newEdge;
        });
    
    
        let calcLeafAtt = leafChar.map((row, i)=> {
            let newRow = {};
            attributeList.forEach((att)=>{
                newRow[att.field] = {};
                newRow[att.field].field = att.field;
                newRow[att.field].type = att.type;
                let values = {}
                d3.entries(row).filter(f=> f.key.includes(att.field)).map(m=> {
                    if(att.type === 'continuous'){
                        values.realVal = m.value;
                    }else{
                        values[m.key] = m.value;   
                    }
                });
                newRow[att.field].values = values;
            });
            newRow.node = row.species;
            newRow.label = row.species;
            
            return newRow;
        })
    
    
        let matchedLeaves = leaves.map((leaf, i)=>{
            let attrib = calcLeafAtt.filter(f=> f.node === leaf.To)[0]
            if(attrib){
                Object.keys(attrib).map((att, i)=>{
                    if(att!='node' && att != 'label'){
                        let scales = calculatedScales.filter(f=> f.field=== att)[0]
                        attrib[att].scales = scales;
                        return att;
                    }
                });
            }
            let newEdge = {
                V1: leaf.From,
                V2: leaf.To,
                node: leaf.To,
                edgeLength: leaf.edgeLength,
                attributes: attrib ? attrib : null,
                group: null,
                leaf: true
            }
            return newEdge;
        });
    
        let all = matchedEdges.filter(f=> f.attributes != null);
    
        let paths = allPaths(all, matchedLeaves, "V1", "V2");
        
        let addedRoot = rootAttribute(paths, calculatedAtt, calculatedScales);
    
        let normedPaths = combineLength(addedRoot);
    
        if(cladesGroupKeeper.length === 0){
            let attArray = calculatedScales.map(m=> m.field)
            if(attArray.indexOf('Clade') > -1){
                let groupData = groupDataByAttribute(calculatedScales, normedPaths, 'Clade');
    
                let chosenClade = addCladeGroup('Clade Attribute', groupData.map(m=> m.label), groupData);
                chosenCladesGroup.push(chosenClade)
    
            }else{
           
                let group = binGroups(normedPaths, dataName, calculatedScales, 8);
    
                let chosenClade = addCladeGroup(dataName, ['Whole Set'], [{'label': dataName, 'paths': normedPaths, 'groupBins': group}]);
                chosenCladesGroup.push(chosenClade);
            }
        }
        

    calculatedScalesKeeper.push(calculatedScales);
    dataMaster.push(normedPaths);
    nestedData.push(buildTreeStructure(normedPaths, all.concat(matchedLeaves)));
    speciesTest.push(normedPaths.flatMap(m=> m.filter(f=> f.leaf === true)).map(l=> l.node));

    return [normedPaths, calculatedScales];
}











