// 全局变量
let allData = [];
let siteConfig = {};
let priceChart = null;
let currentEditId = null;
let githubConfig = {}; // GitHub配置对象

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('admin.html')) {
        // 管理员页面初始化
        initAdminPage();
    } else {
        // 主页面初始化
        initMainPage();
    }
});

// 主页面初始化
function initMainPage() {
    loadData(function() {
        updateFilterOptions();
        renderChart();
        updateStatistics();
        updateSiteInfo();
    });
}

// 管理员页面初始化
function initAdminPage() {
    // 先加载GitHub配置，再加载数据
    if (window.location.pathname.includes('admin.html')) {
        loadGithubConfig();
    }
    
    loadData(function() {
        initLogin();
        updateAdminFilterOptions();
        renderDataTable();
        loadSiteSettings();
    });
}

// 加载数据
function loadData(callback) {
    // 先尝试从GitHub加载数据
    if (githubConfig.username && githubConfig.repo && githubConfig.token) {
        loadDataFromGitHub(function() {
            if (callback) callback();
        });
    } else {
        // 否则从本地加载
        fetch('data.json')
            .then(response => response.json())
            .then(data => {
                processLoadedData(data);
                if (callback) callback();
            })
            .catch(error => {
                console.error('加载本地数据失败:', error);
                // 使用默认数据
                useDefaultData();
                if (callback) callback();
            });
    }
}

// 保存数据
function saveData(callback) {
    const dataToSave = {
        siteConfig: siteConfig,
        transactionData: allData
    };
    
    // 如果配置了GitHub，先保存到GitHub
    if (githubConfig.username && githubConfig.repo && githubConfig.token) {
        saveDataToGitHub(dataToSave, function(success) {
            if (success) {
                alert('数据已成功保存到GitHub！');
            } else {
                alert('GitHub保存失败，将下载本地文件。');
                // 保存失败时，仍然提供本地下载
                downloadLocalData(dataToSave);
            }
            if (callback) callback();
        });
    } else {
        // 没有GitHub配置，只下载本地文件
        downloadLocalData(dataToSave);
        alert('数据已下载到本地，请手动上传到GitHub仓库的根目录。');
        if (callback) callback();
    }
}

// 下载本地数据文件
function downloadLocalData(dataToSave) {
    const dataStr = JSON.stringify(dataToSave, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // 创建临时链接下载
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(dataBlob);
    downloadLink.download = 'data.json';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// 处理加载的数据
function processLoadedData(data) {
    siteConfig = data.siteConfig || {
        siteTitle: "二手房成交走势图",
        siteDescription: "展示各小区户型成交价格走势",
        adminPassword: "admin123"
    };
    allData = data.transactionData || [];
}

// 使用默认数据
function useDefaultData() {
    siteConfig = {
        siteTitle: "二手房成交走势图",
        siteDescription: "展示各小区户型成交价格走势",
        adminPassword: "admin123"
    };
    allData = [];
}

// 从GitHub加载数据
function loadDataFromGitHub(callback) {
    const apiUrl = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data.json`;
    
    fetch(apiUrl, {
        headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('GitHub API请求失败');
        }
        return response.json();
    })
    .then(data => {
        const fileContent = atob(data.content);
        const parsedData = JSON.parse(fileContent);
        processLoadedData(parsedData);
        if (callback) callback();
    })
    .catch(error => {
        console.error('从GitHub加载数据失败:', error);
        // 加载失败时，使用本地数据或默认数据
        fetch('data.json')
            .then(response => response.json())
            .then(data => {
                processLoadedData(data);
                if (callback) callback();
            })
            .catch(() => {
                useDefaultData();
                if (callback) callback();
            });
    });
}

// 保存数据到GitHub
function saveDataToGitHub(dataToSave, callback) {
    const apiUrl = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data.json`;
    const dataStr = JSON.stringify(dataToSave, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(dataStr)));
    
    // 先获取当前文件的SHA值
    fetch(apiUrl, {
        headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('获取文件信息失败');
        }
        return response.json();
    })
    .then(existingFile => {
        // 更新文件
        return fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update data.json',
                content: encodedContent,
                sha: existingFile.sha
            })
        });
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('更新文件失败');
        }
        callback(true);
    })
    .catch(error => {
        console.error('保存到GitHub失败:', error);
        callback(false);
    });
}

// 保存GitHub配置
function saveGithubConfig() {
    const username = document.getElementById('githubUsername').value.trim();
    const repo = document.getElementById('githubRepo').value.trim();
    const token = document.getElementById('githubToken').value;
    
    if (!username || !repo || !token) {
        document.getElementById('githubConfigMessage').innerHTML = 
            '<span style="color: red;">请填写完整的GitHub配置信息</span>';
        return;
    }
    
    // 保存配置
    githubConfig = {
        username: username,
        repo: repo,
        token: token
    };
    
    // 保存到localStorage
    localStorage.setItem('githubConfig', JSON.stringify(githubConfig));
    
    document.getElementById('githubConfigMessage').innerHTML = 
        '<span style="color: green;">GitHub配置保存成功！</span>';
}

// 加载GitHub配置
function loadGithubConfig() {
    const savedConfig = localStorage.getItem('githubConfig');
    if (savedConfig) {
        githubConfig = JSON.parse(savedConfig);
        // 填充表单
        document.getElementById('githubUsername').value = githubConfig.username || '';
        document.getElementById('githubRepo').value = githubConfig.repo || '';
        document.getElementById('githubToken').value = githubConfig.token || '';
    }
}

// 更新网站信息
function updateSiteInfo() {
    document.getElementById('siteTitle').textContent = siteConfig.siteTitle || "二手房成交走势图";
    document.getElementById('siteDescription').textContent = siteConfig.siteDescription || "展示各小区户型成交价格走势";
}

// 更新筛选选项
function updateFilterOptions() {
    const communitySelect = document.getElementById('communitySelect');
    const houseTypeSelect = document.getElementById('houseTypeSelect');
    
    const communities = [...new Set(allData.map(item => item.community))].sort();
    const houseTypes = [...new Set(allData.map(item => item.houseType))].sort();
    
    // 清空现有选项
    communitySelect.innerHTML = '<option value="">全部小区</option>';
    houseTypeSelect.innerHTML = '<option value="">全部户型</option>';
    
    // 添加小区选项
    communities.forEach(community => {
        const option = document.createElement('option');
        option.value = community;
        option.textContent = community;
        communitySelect.appendChild(option);
    });
    
    // 添加户型选项
    houseTypes.forEach(houseType => {
        const option = document.createElement('option');
        option.value = houseType;
        option.textContent = houseType;
        houseTypeSelect.appendChild(option);
    });
    
    // 添加事件监听
    communitySelect.addEventListener('change', function() {
        renderChart();
        updateStatistics();
    });
    
    houseTypeSelect.addEventListener('change', function() {
        renderChart();
        updateStatistics();
    });
    
    // 图表类型选择
    const chartTypeSelect = document.getElementById('chartTypeSelect');
    if (chartTypeSelect) {
        chartTypeSelect.addEventListener('change', function() {
            renderChart();
        });
    }
}

// 筛选数据
function filterData() {
    const community = document.getElementById('communitySelect')?.value || '';
    const houseType = document.getElementById('houseTypeSelect')?.value || '';
    
    return allData.filter(item => {
        const matchCommunity = !community || item.community === community;
        const matchHouseType = !houseType || item.houseType === houseType;
        return matchCommunity && matchHouseType;
    });
}

// 渲染图表
function renderChart() {
    const filteredData = filterData();
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // 按小区和户型分组
    const dataByHouseType = {};
    const houseTypes = [...new Set(filteredData.map(item => item.houseType))];
    
    // 为每种户型生成数据
    houseTypes.forEach(type => {
        const typeData = filteredData.filter(item => item.houseType === type)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        dataByHouseType[type] = {
            dates: typeData.map(item => item.date),
            prices: typeData.map(item => item.price)
        };
    });
    
    // 准备Chart.js数据
    const chartData = {
        datasets: []
    };
    
    // 颜色数组
    const colors = [
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#d35400'
    ];
    
    // 添加每种户型的数据系列
    houseTypes.forEach((type, index) => {
        chartData.datasets.push({
            label: type,
            data: dataByHouseType[type].dates.map((date, i) => ({
                x: new Date(date),
                y: dataByHouseType[type].prices[i]
            })),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            fill: false,
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    });
    
    // 图表类型
    const chartType = document.getElementById('chartTypeSelect')?.value || 'line';
    
    // 销毁现有图表
    if (priceChart) {
        priceChart.destroy();
    }
    
    // 创建新图表
    priceChart = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'yyyy-MM-dd'
                        }
                    },
                    title: {
                        display: true,
                        text: '时间'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '成交价格 (万元/㎡)'
                    },
                    beginAtZero: false,
                    // 启用自动范围调整
                    min: 'auto',
                    max: 'auto',
                    // 添加边距，使数据不紧贴图表边缘
                    grace: 5
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} 万元/㎡`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    // 点击图例时重新计算Y轴范围
                    onClick: function(e, legendItem, legend) {
                        // 切换数据集可见性
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        if (ci.isDatasetVisible(index)) {
                            ci.hide(index);
                        } else {
                            ci.show(index);
                        }
                        
                        // 重新计算Y轴范围
                        const visibleDatasets = ci.data.datasets.filter((_, i) => ci.isDatasetVisible(i));
                        if (visibleDatasets.length > 0) {
                            // 计算所有可见数据的最小值和最大值
                            let allValues = [];
                            visibleDatasets.forEach(dataset => {
                                allValues = allValues.concat(dataset.data.map(d => d.y));
                            });
                            
                            const min = Math.min(...allValues);
                            const max = Math.max(...allValues);
                            const margin = (max - min) * 0.05; // 5%的边距
                            
                            // 更新Y轴范围
                            ci.options.scales.y.min = min - margin;
                            ci.options.scales.y.max = max + margin;
                            ci.update();
                        }
                        
                        // 触发legend点击事件
                        e.stopPropagation();
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            // 数据集可见性变化时重新计算Y轴范围
            onDatasetVisibilityChange: function(chart, datasetIndex, isVisible) {
                const visibleDatasets = chart.data.datasets.filter((_, i) => chart.isDatasetVisible(i));
                if (visibleDatasets.length > 0) {
                    // 计算所有可见数据的最小值和最大值
                    let allValues = [];
                    visibleDatasets.forEach(dataset => {
                        allValues = allValues.concat(dataset.data.map(d => d.y));
                    });
                    
                    const min = Math.min(...allValues);
                    const max = Math.max(...allValues);
                    const margin = (max - min) * 0.05; // 5%的边距
                    
                    // 更新Y轴范围
                    chart.options.scales.y.min = min - margin;
                    chart.options.scales.y.max = max + margin;
                    chart.update();
                } else {
                    // 没有可见数据集时，重置Y轴
                    chart.options.scales.y.min = null;
                    chart.options.scales.y.max = null;
                    chart.update();
                }
            }
        }
    });
}

// 更新统计信息
function updateStatistics() {
    const filteredData = filterData();
    
    if (filteredData.length === 0) {
        updateStatElement('avgPrice', '-');
        updateStatElement('maxPrice', '-');
        updateStatElement('minPrice', '-');
        updateStatElement('priceChange', '-');
        updateStatElement('avgArea', '-');
        updateStatElement('totalCount', '-');
        return;
    }
    
    // 计算价格统计
    const prices = filteredData.map(item => item.price);
    const avgPrice = (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
    const maxPrice = Math.max(...prices).toFixed(2);
    const minPrice = Math.min(...prices).toFixed(2);
    
    // 计算价格变化
    const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));
    let priceChange = '0.00%';
    let changeClass = '';
    
    if (sortedData.length >= 2) {
        const firstPrice = sortedData[0].price;
        const lastPrice = sortedData[sortedData.length - 1].price;
        const changePercent = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
        priceChange = `${changePercent > 0 ? '+' : ''}${changePercent}%`;
        changeClass = changePercent > 0 ? 'price-increase' : changePercent < 0 ? 'price-decrease' : '';
    }
    
    // 计算面积统计
    const areas = filteredData.map(item => item.area);
    const avgArea = (areas.reduce((sum, area) => sum + area, 0) / areas.length).toFixed(1);
    
    // 更新统计元素
    updateStatElement('avgPrice', `${avgPrice} 万元/㎡`);
    updateStatElement('maxPrice', `${maxPrice} 万元/㎡`);
    updateStatElement('minPrice', `${minPrice} 万元/㎡`);
    updateStatElement('priceChange', priceChange, changeClass);
    updateStatElement('avgArea', `${avgArea} ㎡`);
    updateStatElement('totalCount', filteredData.length + ' 套');
}

// 更新统计元素
function updateStatElement(elementId, value, className = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        element.className = 'stat-value';
        if (className) {
            element.classList.add(className);
        }
    }
}

// 更新网站信息
function updateSiteInfo() {
    const titleElement = document.getElementById('siteTitle');
    const descElement = document.getElementById('siteDescription');
    
    if (titleElement) {
        titleElement.textContent = siteConfig.siteTitle || '二手房成交走势图';
    }
    
    if (descElement) {
        descElement.textContent = siteConfig.siteDescription || '展示各小区户型成交价格走势';
    }
}

// 导出数据
function exportData() {
    const filteredData = filterData();
    if (filteredData.length === 0) {
        alert('没有数据可导出');
        return;
    }
    
    // 创建CSV内容
    const headers = ['小区', '户型', '时间', '价格(万元/㎡)', '面积(㎡)'];
    const rows = filteredData.map(item => [
        item.community,
        item.houseType,
        item.date,
        item.price,
        item.area
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // 下载CSV文件
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `二手房成交数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 导出图表
function exportChart() {
    const canvas = document.getElementById('priceChart');
    if (!canvas) return;
    
    // 下载图表图片
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `价格走势图_${new Date().toISOString().slice(0, 10)}.png`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 初始化登录
function initLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    
    loginBtn.addEventListener('click', function() {
        const password = passwordInput.value;
        if (password === siteConfig.adminPassword) {
            // 登录成功
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
            loginError.textContent = '';
        } else {
            // 登录失败
            loginError.textContent = '密码错误，请重试';
        }
    });
    
    // 回车登录
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
}

// 更新管理员筛选选项
function updateAdminFilterOptions() {
    const communitySelect = document.getElementById('adminCommunitySelect');
    const houseTypeSelect = document.getElementById('adminHouseTypeSelect');
    
    const communities = [...new Set(allData.map(item => item.community))].sort();
    const houseTypes = [...new Set(allData.map(item => item.houseType))].sort();
    
    // 清空现有选项
    communitySelect.innerHTML = '<option value="">全部小区</option>';
    houseTypeSelect.innerHTML = '<option value="">全部户型</option>';
    
    // 添加小区选项
    communities.forEach(community => {
        const option = document.createElement('option');
        option.value = community;
        option.textContent = community;
        communitySelect.appendChild(option);
    });
    
    // 添加户型选项
    houseTypes.forEach(houseType => {
        const option = document.createElement('option');
        option.value = houseType;
        option.textContent = houseType;
        houseTypeSelect.appendChild(option);
    });
    
    // 添加筛选事件监听
    communitySelect.addEventListener('change', renderDataTable);
    houseTypeSelect.addEventListener('change', renderDataTable);
    
    // 清除筛选按钮
    document.getElementById('clearFiltersBtn').addEventListener('click', function() {
        communitySelect.value = '';
        houseTypeSelect.value = '';
        renderDataTable();
    });
}

// 筛选管理员数据
function filterAdminData() {
    const community = document.getElementById('adminCommunitySelect').value || '';
    const houseType = document.getElementById('adminHouseTypeSelect').value || '';
    
    return allData.filter(item => {
        const matchCommunity = !community || item.community === community;
        const matchHouseType = !houseType || item.houseType === houseType;
        return matchCommunity && matchHouseType;
    });
}

// 渲染数据表格
function renderDataTable() {
    const filteredData = filterAdminData();
    const tableBody = document.getElementById('dataTableBody');
    
    // 清空表格
    tableBody.innerHTML = '';
    
    // 渲染数据行
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.dataset.id = item.id;
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.community}</td>
            <td>${item.houseType}</td>
            <td>${item.date}</td>
            <td>${item.price}</td>
            <td>${item.area}</td>
            <td>
                <button class="edit-btn" onclick="editRecord(${item.id})">编辑</button>
                <button class="delete-btn" onclick="deleteRecord(${item.id})">删除</button>
            </td>
        `;
        
        // 行点击事件
        row.addEventListener('click', function() {
            // 移除其他行的选中状态
            document.querySelectorAll('#dataTableBody tr').forEach(r => r.classList.remove('selected-row'));
            // 添加当前行的选中状态
            this.classList.add('selected-row');
        });
        
        tableBody.appendChild(row);
    });
}

// 添加记录
function addRecord() {
    const community = document.getElementById('communityInput').value.trim();
    const houseType = document.getElementById('houseTypeInput').value.trim();
    const date = document.getElementById('dateInput').value;
    const price = parseFloat(document.getElementById('priceInput').value);
    const area = parseFloat(document.getElementById('areaInput').value);
    
    // 验证输入
    if (!community || !houseType || !date || isNaN(price) || isNaN(area)) {
        alert('请填写完整的记录信息');
        return;
    }
    
    // 生成新ID
    const maxId = allData.length > 0 ? Math.max(...allData.map(item => item.id)) : 0;
    const newId = maxId + 1;
    
    // 创建新记录
    const newRecord = {
        id: newId,
        community: community,
        houseType: houseType,
        date: date,
        price: price,
        area: area
    };
    
    // 添加到数据
    allData.push(newRecord);
    
    // 保存数据
    saveData(function() {
        // 更新界面
        renderDataTable();
        updateAdminFilterOptions();
        clearForm();
    });
}

// 编辑记录
function editRecord(id) {
    const record = allData.find(item => item.id === id);
    if (!record) return;
    
    // 填充表单
    document.getElementById('communityInput').value = record.community;
    document.getElementById('houseTypeInput').value = record.houseType;
    document.getElementById('dateInput').value = record.date;
    document.getElementById('priceInput').value = record.price;
    document.getElementById('areaInput').value = record.area;
    
    // 设置当前编辑ID
    currentEditId = id;
    
    // 更新按钮状态
    document.getElementById('addRecordBtn').textContent = '保存修改';
    document.getElementById('editRecordBtn').disabled = true;
    document.getElementById('deleteRecordBtn').disabled = true;
}

// 保存编辑
function saveEdit() {
    if (!currentEditId) return;
    
    const community = document.getElementById('communityInput').value.trim();
    const houseType = document.getElementById('houseTypeInput').value.trim();
    const date = document.getElementById('dateInput').value;
    const price = parseFloat(document.getElementById('priceInput').value);
    const area = parseFloat(document.getElementById('areaInput').value);
    
    // 验证输入
    if (!community || !houseType || !date || isNaN(price) || isNaN(area)) {
        alert('请填写完整的记录信息');
        return;
    }
    
    // 更新记录
    const recordIndex = allData.findIndex(item => item.id === currentEditId);
    if (recordIndex !== -1) {
        allData[recordIndex] = {
            ...allData[recordIndex],
            community: community,
            houseType: houseType,
            date: date,
            price: price,
            area: area
        };
        
        // 保存数据
        saveData(function() {
            // 更新界面
            renderDataTable();
            updateAdminFilterOptions();
            clearForm();
        });
    }
}

// 删除记录
function deleteRecord(id) {
    if (confirm('确定要删除这条记录吗？')) {
        allData = allData.filter(item => item.id !== id);
        
        // 保存数据
        saveData(function() {
            // 更新界面
            renderDataTable();
            updateAdminFilterOptions();
        });
    }
}

// 清空表单
function clearForm() {
    document.getElementById('communityInput').value = '';
    document.getElementById('houseTypeInput').value = '';
    document.getElementById('dateInput').value = '';
    document.getElementById('priceInput').value = '';
    document.getElementById('areaInput').value = '';
    
    currentEditId = null;
    document.getElementById('addRecordBtn').textContent = '添加记录';
    document.getElementById('editRecordBtn').disabled = false;
    document.getElementById('deleteRecordBtn').disabled = false;
}

// 批量导入CSV数据
function importCSVData(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const csvContent = e.target.result;
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            alert('CSV文件为空');
            return;
        }
        
        // 解析CSV数据
        const importedData = [];
        const maxId = allData.length > 0 ? Math.max(...allData.map(item => item.id)) : 0;
        
        // 从第二行开始解析数据（跳过表头）
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(val => val.replace(/"/g, '').trim());
            if (values.length >= 5) {
                const newId = maxId + i;
                importedData.push({
                    id: newId,
                    community: values[0],
                    houseType: values[1],
                    date: values[2],
                    price: parseFloat(values[3]),
                    area: parseFloat(values[4])
                });
            }
        }
        
        if (importedData.length === 0) {
            alert('没有导入任何有效数据');
            return;
        }
        
        // 添加到现有数据
        allData = [...allData, ...importedData];
        
        // 保存数据
        saveData(function() {
            // 更新界面
            renderDataTable();
            updateAdminFilterOptions();
            document.getElementById('importMessage').innerHTML = 
                `<span style="color: green;">成功导入 ${importedData.length} 条记录！</span>`;
            alert('数据导入成功！请保存下载的data.json文件并替换原文件。');
        });
    };
    
    reader.onerror = function() {
        alert('读取文件失败');
    };
    
    reader.readAsText(file);
}

// 保存网站设置
function saveSiteSettings() {
    const newTitle = document.getElementById('siteTitleInput').value.trim();
    const newDescription = document.getElementById('siteDescriptionInput').value.trim();
    const newPassword = document.getElementById('newPasswordInput').value;
    
    // 更新设置
    if (newTitle) {
        siteConfig.siteTitle = newTitle;
    }
    
    if (newDescription) {
        siteConfig.siteDescription = newDescription;
    }
    
    if (newPassword) {
        siteConfig.adminPassword = newPassword;
    }
    
    // 保存数据
    saveData(function() {
        alert('网站设置保存成功！请保存下载的data.json文件并替换原文件。');
        // 清空密码输入框
        document.getElementById('newPasswordInput').value = '';
    });
}

// 加载网站设置到表单
function loadSiteSettings() {
    document.getElementById('siteTitleInput').value = siteConfig.siteTitle || '';
    document.getElementById('siteDescriptionInput').value = siteConfig.siteDescription || '';
}

// 事件监听设置
function setupEventListeners() {
    // 主页面事件
    if (!window.location.pathname.includes('admin.html')) {
        // 导出数据按钮
        document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
        // 导出图表按钮
        document.getElementById('exportChartBtn')?.addEventListener('click', exportChart);
    } else {
        // 管理员页面事件
        // 登录按钮
        document.getElementById('loginBtn')?.addEventListener('click', function() {
            const password = document.getElementById('password').value;
            if (password === siteConfig.adminPassword) {
                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('adminContent').style.display = 'block';
            } else {
                document.getElementById('loginError').textContent = '密码错误，请重试';
            }
        });
        
        // 添加/保存按钮
        document.getElementById('addRecordBtn')?.addEventListener('click', function() {
            if (currentEditId) {
                saveEdit();
            } else {
                addRecord();
            }
        });
        
        // 编辑按钮
        document.getElementById('editRecordBtn')?.addEventListener('click', function() {
            // 从选中行获取ID
            const selectedRow = document.querySelector('#dataTableBody .selected-row');
            if (selectedRow) {
                const id = parseInt(selectedRow.dataset.id);
                editRecord(id);
            }
        });
        
        // 删除按钮
        document.getElementById('deleteRecordBtn')?.addEventListener('click', function() {
            // 从选中行获取ID
            const selectedRow = document.querySelector('#dataTableBody .selected-row');
            if (selectedRow) {
                const id = parseInt(selectedRow.dataset.id);
                deleteRecord(id);
            }
        });
        
        // 清空表单按钮
        document.getElementById('clearFormBtn')?.addEventListener('click', clearForm);
        
        // 导入按钮
        document.getElementById('importBtn')?.addEventListener('click', function() {
            const fileInput = document.getElementById('csvFile');
            const file = fileInput.files[0];
            if (file) {
                importCSVData(file);
            } else {
                alert('请选择要导入的CSV文件');
            }
        });
        
        // 保存设置按钮
        document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSiteSettings);
        
        // GitHub配置相关事件
        document.getElementById('saveGithubConfigBtn')?.addEventListener('click', saveGithubConfig);
        
        // 加载GitHub配置
        loadGithubConfig();
    }
}

// 初始化事件监听
setupEventListeners();