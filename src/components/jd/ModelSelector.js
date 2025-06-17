import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Slider,
  Grid,
  Paper,
  Tooltip,
  Divider,
  Chip
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import bedrockApiService from '../../services/bedrock-api-service';

/**
 * Component for selecting Bedrock models and their parameters
 */
const ModelSelector = ({ 
  selectedModel, 
  setSelectedModel, 
  modelParameters, 
  setModelParameters 
}) => {
  const [availableModels, setAvailableModels] = useState([]);
  
  // Initialize available models
  useEffect(() => {
    const models = bedrockApiService.getSupportedModels();
    setAvailableModels(models);
    
    // If no model is selected, select the first one
    if (!selectedModel && models.length > 0) {
      handleModelChange(models[0].id);
    }
  }, []);
  
  // Handle model change
  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    
    // Get default parameters for the selected model
    const params = bedrockApiService.getDefaultParametersForModel(modelId);
    setModelParameters(params);
  };
  
  // Get the currently selected model object
  const currentModel = availableModels.find(model => model.id === selectedModel) || {};
  
  // Handle parameter changes
  const handleParameterChange = (param, value) => {
    setModelParameters({
      ...modelParameters,
      [param]: value
    });
  };
  
  // Render parameter controls based on the model format
  const renderParameterControls = () => {
    if (!currentModel || !currentModel.parameterFormat) return null;
    
    const format = currentModel.parameterFormat;
    
    if (format === 'llama') {
      return (
        <>
          <ParameterSlider
            label="Maximum Length"
            tooltip="Maximum number of tokens to generate"
            value={modelParameters?.max_gen_len || 512}
            onChange={(value) => handleParameterChange('max_gen_len', value)}
            min={64}
            max={1024}
            step={64}
            marks={[
              { value: 64, label: '64' },
              { value: 512, label: '512' },
              { value: 1024, label: '1024' }
            ]}
          />
          
          <ParameterSlider
            label="Temperature"
            tooltip="Controls randomness - higher values produce more creative but less predictable output"
            value={modelParameters?.temperature || 0.5}
            onChange={(value) => handleParameterChange('temperature', value)}
            min={0}
            max={1}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 0.5, label: '0.5' },
              { value: 1, label: '1' }
            ]}
          />
          
          <ParameterSlider
            label="Top P"
            tooltip="Nucleus sampling - controls diversity of generated text"
            value={modelParameters?.top_p || 0.9}
            onChange={(value) => handleParameterChange('top_p', value)}
            min={0.1}
            max={1}
            step={0.1}
            marks={[
              { value: 0.1, label: '0.1' },
              { value: 0.9, label: '0.9' }
            ]}
          />
        </>
      );
    } else if (format === 'claude') {
      return (
        <>
          <ParameterSlider
            label="Max Tokens"
            tooltip="Maximum number of tokens to sample"
            value={modelParameters?.max_tokens_to_sample || 1024}
            onChange={(value) => handleParameterChange('max_tokens_to_sample', value)}
            min={256}
            max={1536}
            step={128}
            marks={[
              { value: 256, label: '256' },
              { value: 1024, label: '1024' },
              { value: 1536, label: '1536' }
            ]}
          />
          
          <ParameterSlider
            label="Temperature"
            tooltip="Controls randomness - higher values produce more creative but less predictable output"
            value={modelParameters?.temperature || 0.3}
            onChange={(value) => handleParameterChange('temperature', value)}
            min={0}
            max={1}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 0.3, label: '0.3' },
              { value: 1, label: '1' }
            ]}
          />
          
          <ParameterSlider
            label="Top P"
            tooltip="Nucleus sampling - controls diversity of generated text"
            value={modelParameters?.top_p || 0.9}
            onChange={(value) => handleParameterChange('top_p', value)}
            min={0.1}
            max={1}
            step={0.1}
            marks={[
              { value: 0.1, label: '0.1' },
              { value: 0.9, label: '0.9' }
            ]}
          />
        </>
      );
    } else if (format === 'titan') {
      return (
        <>
          <ParameterSlider
            label="Max Token Count"
            tooltip="Maximum number of tokens to generate"
            value={modelParameters?.maxTokenCount || 800}
            onChange={(value) => handleParameterChange('maxTokenCount', value)}
            min={128}
            max={1024}
            step={128}
            marks={[
              { value: 128, label: '128' },
              { value: 512, label: '512' },
              { value: 1024, label: '1024' }
            ]}
          />
          
          <ParameterSlider
            label="Temperature"
            tooltip="Controls randomness - higher values produce more creative but less predictable output"
            value={modelParameters?.temperature || 0.4}
            onChange={(value) => handleParameterChange('temperature', value)}
            min={0}
            max={1}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 0.4, label: '0.4' },
              { value: 1, label: '1' }
            ]}
          />
          
          <ParameterSlider
            label="Top P"
            tooltip="Nucleus sampling - controls diversity of generated text"
            value={modelParameters?.topP || 0.9}
            onChange={(value) => handleParameterChange('topP', value)}
            min={0.1}
            max={1}
            step={0.1}
            marks={[
              { value: 0.1, label: '0.1' },
              { value: 0.9, label: '0.9' }
            ]}
          />
        </>
      );
    }
    
    return null;
  };

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Analysis Model Settings
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel id="model-select-label">Model</InputLabel>
            <Select
              labelId="model-select-label"
              id="model-select"
              value={selectedModel || ''}
              label="Model"
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {availableModels.map(model => (
                <MenuItem key={model.id} value={model.id}>
                  <Grid container alignItems="center" spacing={1}>
                    <Grid item>
                      <Chip 
                        label={model.provider} 
                        size="small" 
                        color={
                          model.provider === 'Meta' ? 'primary' : 
                          model.provider === 'Anthropic' ? 'secondary' : 
                          'default'
                        } 
                      />
                    </Grid>
                    <Grid item>{model.name}</Grid>
                  </Grid>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {currentModel && currentModel.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {currentModel.description}
            </Typography>
          )}
        </Grid>
        
        <Grid item xs={12} md={6}>
          {renderParameterControls()}
        </Grid>
      </Grid>
    </Paper>
  );
};

// Helper component for parameter sliders
const ParameterSlider = ({ label, tooltip, value, onChange, min, max, step, marks }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <Typography id={`${label}-slider`} variant="body2">
            {label}
          </Typography>
        </Grid>
        <Grid item>
          <Tooltip title={tooltip}>
            <HelpOutlineIcon fontSize="small" color="action" />
          </Tooltip>
        </Grid>
        <Grid item xs>
          <Slider
            value={typeof value === 'number' ? value : 0}
            onChange={(e, newValue) => onChange(newValue)}
            aria-labelledby={`${label}-slider`}
            valueLabelDisplay="auto"
            min={min}
            max={max}
            step={step}
            marks={marks}
          />
        </Grid>
        <Grid item>
          <Typography variant="body2" color="text.secondary">
            {value}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ModelSelector;